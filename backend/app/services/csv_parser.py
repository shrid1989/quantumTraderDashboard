"""CSV parser service for QuantumTrader Dashboard API"""
import csv
from io import StringIO
from typing import List, Tuple

from app.models import TradeCreate
from app.utils.logger import get_logger
from app.utils.exceptions import CSVParseException

logger = get_logger()


class CSVParserService:
    """Service for parsing trades CSV files"""

    # Expected CSV columns mapping
    EXPECTED_COLUMNS = [
        "date",
        "nifty_value",
        "strategy",
        "entry_reason",
        "option_strike",
        "sold_option",
        "position_type",
        "entry_time",
        "entry_premium",
        "exit_time",
        "exit_premium",
        "exit_reason",
        "quantity",
        "pnl",
    ]

    # Optional columns
    OPTIONAL_COLUMNS = [
        "ce_symbol",
        "pe_symbol",
        "straddle_vwap",
    ]

    @staticmethod
    def parse_csv_content(csv_content: str) -> List[TradeCreate]:
        """Parse CSV content and return Trade objects"""
        try:
            lines = csv_content.strip().split('\n')
            if not lines:
                raise CSVParseException("CSV file is empty")

            reader = csv.DictReader(lines)
            if not reader.fieldnames:
                raise CSVParseException("CSV file has no headers")

            # Validate columns
            csv_columns = set(reader.fieldnames)
            required_columns = set(CSVParserService.EXPECTED_COLUMNS)

            missing_columns = required_columns - csv_columns
            if missing_columns:
                raise CSVParseException(f"Missing required columns: {', '.join(missing_columns)}")

            trades = []
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                try:
                    trade = CSVParserService.parse_row(row)
                    trades.append(trade)
                except Exception as e:
                    logger.warning(f"Failed to parse row {row_num}: {str(e)}")
                    continue

            if not trades:
                raise CSVParseException("No valid trades found in CSV")

            logger.info(f"✓ Parsed {len(trades)} trades from CSV")
            return trades

        except CSVParseException:
            raise
        except Exception as e:
            logger.error(f"✗ CSV parsing failed: {str(e)}")
            raise CSVParseException(f"Failed to parse CSV: {str(e)}")

    @staticmethod
    def parse_row(row: dict) -> TradeCreate:
        """Parse a single CSV row into a TradeCreate object"""
        try:
            # Parse required fields
            date = str(row.get("date", "")).strip()
            nifty_value = float(row.get("nifty_value", 0))
            strategy = str(row.get("strategy", "")).strip()
            entry_reason = str(row.get("entry_reason", "")).strip()
            option_strike = int(float(row.get("option_strike", 0)))
            sold_option = str(row.get("sold_option", "")).strip()
            position_type = str(row.get("position_type", "")).strip()
            entry_time = str(row.get("entry_time", "")).strip()
            entry_premium = float(row.get("entry_premium", 0))
            exit_time = str(row.get("exit_time", "")).strip()
            exit_premium = float(row.get("exit_premium", 0))
            exit_reason = str(row.get("exit_reason", "")).strip()
            quantity = int(float(row.get("quantity", 1)))
            pnl = float(row.get("pnl", 0))

            # Parse optional fields
            ce_symbol = str(row.get("ce_symbol", "")).strip() or None
            pe_symbol = str(row.get("pe_symbol", "")).strip() or None
            straddle_vwap = None
            if row.get("straddle_vwap"):
                try:
                    straddle_vwap = float(row.get("straddle_vwap"))
                except (ValueError, TypeError):
                    straddle_vwap = None

            # Validate required fields
            if not date:
                raise ValueError("date is required")
            if not strategy:
                raise ValueError("strategy is required")
            if not position_type:
                raise ValueError("position_type is required")

            # Create TradeCreate object
            trade = TradeCreate(
                date=date,
                nifty_value=nifty_value,
                strategy=strategy,
                entry_reason=entry_reason,
                option_strike=option_strike,
                sold_option=sold_option,
                position_type=position_type,
                entry_time=entry_time,
                entry_premium=entry_premium,
                exit_time=exit_time,
                exit_premium=exit_premium,
                exit_reason=exit_reason,
                quantity=quantity,
                pnl=pnl,
                ce_symbol=ce_symbol,
                pe_symbol=pe_symbol,
                straddle_vwap=straddle_vwap,
            )

            return trade

        except ValueError as e:
            raise CSVParseException(f"Invalid field value: {str(e)}")
        except Exception as e:
            raise CSVParseException(f"Failed to parse row: {str(e)}")

    @staticmethod
    def validate_csv_structure(csv_content: str) -> Tuple[bool, str]:
        """Validate CSV structure without parsing"""
        try:
            lines = csv_content.strip().split('\n')
            if not lines:
                return False, "CSV file is empty"

            reader = csv.DictReader(lines)
            if not reader.fieldnames:
                return False, "CSV file has no headers"

            # Check for required columns
            csv_columns = set(reader.fieldnames)
            required_columns = set(CSVParserService.EXPECTED_COLUMNS)
            missing = required_columns - csv_columns

            if missing:
                return False, f"Missing columns: {', '.join(missing)}"

            # Check for at least one row
            has_rows = False
            for _ in reader:
                has_rows = True
                break

            if not has_rows:
                return False, "CSV has headers but no data rows"

            return True, "CSV structure is valid"

        except Exception as e:
            return False, f"Invalid CSV format: {str(e)}"


def get_csv_parser_service() -> CSVParserService:
    """Get the CSV parser service (static class)"""
    return CSVParserService()
