"""
Local test for s3_trigger_lambda.py
Runs parse_csv against a real CSV file WITHOUT needing AWS or Supabase.

Usage:
    python test_local.py ../../trades_2026-03-10.csv
"""
import sys
import os

# Allow importing the lambda module
sys.path.insert(0, os.path.dirname(__file__))
import s3_trigger_lambda as lf


def test_parse_csv(csv_path: str):
    print(f"\n=== Testing CSV parse: {csv_path} ===\n")

    with open(csv_path, "rb") as f:
        raw_bytes = f.read()

    # Same encoding detection as Lambda
    csv_content = None
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            csv_content = raw_bytes.decode(encoding)
            print(f"✓ Decoded with encoding: {encoding}")
            break
        except (UnicodeDecodeError, LookupError):
            continue

    if csv_content is None:
        print("✗ ERROR: Could not decode file with any encoding")
        return

    logger = lf.get_logger()
    rows = lf.parse_csv(csv_content, logger)

    if not rows:
        print("✗ ERROR: No rows parsed — check CSV headers/content above")
        return

    print(f"\n✓ Parsed {len(rows)} rows successfully")
    print(f"\nFirst row sample:")
    for k, v in rows[0].items():
        print(f"  {k}: {v!r}")


def test_filename_validation():
    print("\n=== Testing filename validation ===\n")
    cases = [
        ("trades_2026-03-10.csv", True),
        ("trades_2026-01-01.csv", True),
        ("summary.csv", False),
        ("trades_2026-3-1.csv", False),
        ("paper-trading/trades_2026-03-10.csv", False),  # full key path
    ]
    for filename, expected in cases:
        result = lf.is_valid_trades_file(filename)
        status = "✓" if result == expected else "✗"
        print(f"  {status} is_valid_trades_file({filename!r}) = {result} (expected {expected})")


if __name__ == "__main__":
    test_filename_validation()

    csv_path = sys.argv[1] if len(sys.argv) > 1 else "../../trades_2026-03-10.csv"
    if os.path.exists(csv_path):
        test_parse_csv(csv_path)
    else:
        print(f"\n⚠ CSV file not found: {csv_path}")
        print("Usage: python test_local.py /path/to/trades.csv")
