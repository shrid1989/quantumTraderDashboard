"""
AWS Lambda Function for QuantumTrader S3 Auto-Sync
Triggered when trading bot uploads CSV to S3
Writes directly to Supabase PostgreSQL via REST API (no external dependencies)
"""
import json
import boto3
import csv
import os
import re
import urllib.request
import urllib.error
from datetime import datetime

s3_client = boto3.client("s3")

# Environment variables (set in Lambda function configuration)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


def lambda_handler(event, context):
    """
    Lambda handler for S3 events
    Triggered when CSV file is uploaded to S3
    """
    logger = get_logger()
    try:
        logger.info("🔄 Lambda triggered for S3 sync")

        # Parse S3 event
        records = event.get("Records", [])
        if not records:
            return error_response("No S3 records found")

        bucket = records[0]["s3"]["bucket"]["name"]
        key = records[0]["s3"]["object"]["key"]
        logger.info(f"Processing: s3://{bucket}/{key}")

        # Validate: only process trades_YYYY-MM-DD.csv files
        filename = key.split("/")[-1]
        if not is_valid_trades_file(filename):
            logger.warning(f"Skipped: {filename} does not match pattern")
            return success_response("Skipped: Not a trades CSV file")

        # Download CSV from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        raw_bytes = response["Body"].read()
        for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
            try:
                csv_content = raw_bytes.decode(encoding)
                break
            except (UnicodeDecodeError, LookupError):
                continue
        else:
            return error_response("Could not decode CSV: unsupported file encoding")
        logger.info(f"✓ Downloaded CSV from S3: {key}")

        # Parse CSV and build rows
        rows = parse_csv(csv_content, logger)
        if not rows:
            return error_response("No valid rows parsed from CSV")

        # Write to Supabase via REST API
        trades_added = upsert_to_supabase(rows, logger)

        logger.info(f"✓ Upserted {trades_added} trades to Supabase")
        return success_response(f"Synced {trades_added} trades", {"trades_added": trades_added})

    except Exception as e:
        logger = get_logger()
        logger.error(f"Lambda error: {str(e)}")
        return error_response(f"Lambda error: {str(e)}", 500)


def parse_csv(csv_content: str, logger) -> list:
    """Parse CSV content into list of trade dicts for Supabase"""
    rows = []
    # splitlines() handles \r\n (Windows), \n (Unix), \r (old Mac) correctly
    lines = csv_content.splitlines()
    reader = csv.DictReader(lines)

    for row_num, row in enumerate(reader, start=2):
        try:
            date = row.get("date", "").strip()
            entry_time = row.get("entry_time", "").strip()
            strategy = row.get("strategy", "").strip()
            nifty_value = row.get("nifty_value", "0").strip()

            # Silently skip blank rows (Excel pads sheets with thousands of empty rows)
            if not any(v.strip() for v in row.values() if v):
                continue

            if not date or not strategy:
                logger.warning(f"Row {row_num}: missing required fields (date={date!r}, strategy={strategy!r}), skipping")
                continue

            trade_id = f"{date}#{nifty_value}#{entry_time}#{strategy}"

            def safe_float(val, default=None):
                try:
                    return float(val) if val and val.strip() else default
                except (ValueError, AttributeError):
                    return default

            def safe_int(val, default=None):
                try:
                    return int(float(val)) if val and val.strip() else default
                except (ValueError, AttributeError):
                    return default

            rows.append({
                "trade_id": trade_id,
                "date": date,
                "nifty_value": safe_float(nifty_value),
                "strategy": strategy,
                "entry_reason": row.get("entry_reason", "").strip(),
                "option_strike": safe_int(row.get("option_strike")),
                "sold_option": row.get("sold_option", "").strip(),
                "position_type": row.get("position_type", "").strip(),
                "entry_time": entry_time or None,
                "entry_premium": safe_float(row.get("entry_premium")),
                "exit_time": row.get("exit_time", "").strip() or None,
                "exit_premium": safe_float(row.get("exit_premium")),
                "exit_reason": row.get("exit_reason", "").strip(),
                "quantity": safe_int(row.get("quantity"), 1),
                "pnl": safe_float(row.get("pnl"), 0.0),
                "ce_symbol": row.get("ce_symbol", "").strip() or None,
                "pe_symbol": row.get("pe_symbol", "").strip() or None,
                "straddle_vwap": safe_float(row.get("straddle_vwap")),
                "pivot": safe_float(row.get("pivot")),
                "s1": safe_float(row.get("s1")),
                "s2": safe_float(row.get("s2")),
                "r1": safe_float(row.get("r1")),
                "r2": safe_float(row.get("r2")),
                "timestamp": datetime.utcnow().isoformat(),
            })
        except Exception as e:
            logger.warning(f"Row {row_num}: parse error - {str(e)}")
            continue

    return rows


def upsert_to_supabase(rows: list, logger) -> int:
    """Upsert trades to Supabase via PostgREST API (no supabase-py needed)"""
    url = f"{SUPABASE_URL}/rest/v1/trades"
    data = json.dumps(rows).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            return len(result) if isinstance(result, list) else len(rows)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        logger.error(f"Supabase API error {e.code}: {body}")
        raise


def is_valid_trades_file(filename):
    """Validate that filename matches trades_YYYY-MM-DD.csv"""
    pattern = r"trades_\d{4}-\d{2}-\d{2}\.csv"
    return bool(re.match(pattern, filename))


def get_logger():
    """Simple logger"""
    class Logger:
        def info(self, msg):
            print(f"[INFO] {datetime.now().isoformat()} - {msg}")

        def error(self, msg):
            print(f"[ERROR] {datetime.now().isoformat()} - {msg}")

        def warning(self, msg):
            print(f"[WARNING] {datetime.now().isoformat()} - {msg}")

    return Logger()


def success_response(message, data=None, status_code=200):
    """Format success response"""
    return {
        "statusCode": status_code,
        "body": json.dumps({
            "status": "success",
            "message": message,
            "data": data or {},
        }),
    }


def error_response(message, status_code=400):
    """Format error response"""
    return {
        "statusCode": status_code,
        "body": json.dumps({
            "status": "error",
            "message": message,
        }),
    }
