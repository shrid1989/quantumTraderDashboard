"""Trade service for QuantumTrader Dashboard API"""
from typing import List, Optional, Dict
from datetime import datetime

from app.models import TradeCreate, TradeResponse, TradeUpdateResponse, TradeFilterRequest
from app.database import get_db_client
from app.utils.logger import get_logger
from app.utils.exceptions import DatabaseException, TradeNotFound

logger = get_logger()


class TradeService:
    """Service for managing trades in Supabase"""

    def __init__(self):
        """Initialize trade service"""
        self.db = get_db_client()

    def generate_trade_id(self, date: str, nifty_value: float, entry_time: str, strategy: str) -> str:
        """Generate unique trade ID"""
        trade_key = f"{date}#{nifty_value}#{entry_time}#{strategy}"
        return trade_key

    def create_trade(self, trade: TradeCreate) -> TradeResponse:
        """Create a new trade"""
        try:
            # Generate trade ID
            trade_id = self.generate_trade_id(
                trade.date,
                trade.nifty_value,
                trade.entry_time,
                trade.strategy,
            )

            timestamp = datetime.utcnow().isoformat()

            # Prepare item for PostgreSQL (native Python types)
            item = {
                "trade_id": trade_id,
                "timestamp": timestamp,
                "date": trade.date,
                "nifty_value": trade.nifty_value,
                "strategy": trade.strategy,
                "entry_reason": trade.entry_reason,
                "option_strike": trade.option_strike,
                "sold_option": trade.sold_option,
                "position_type": trade.position_type,
                "entry_time": trade.entry_time,
                "entry_premium": trade.entry_premium,
                "exit_time": trade.exit_time,
                "exit_premium": trade.exit_premium,
                "exit_reason": trade.exit_reason,
                "quantity": trade.quantity,
                "pnl": trade.pnl,
                "ce_symbol": trade.ce_symbol or "",
                "pe_symbol": trade.pe_symbol or "",
                "straddle_vwap": trade.straddle_vwap or 0,
            }

            # Insert item into Supabase
            self.db.put_item(item)
            logger.info(f"✓ Trade created: {trade_id} | PnL: {trade.pnl}")

            return TradeResponse(
                trade_id=trade_id,
                timestamp=timestamp,
                **trade.dict()
            )

        except DatabaseException:
            raise
        except Exception as e:
            logger.error(f"✗ Failed to create trade: {str(e)}")
            raise DatabaseException(f"Failed to create trade: {str(e)}")

    def get_trade(self, trade_id: str, timestamp: str) -> Optional[TradeResponse]:
        """Get a trade by ID"""
        try:
            item = self.db.get_item(trade_id, timestamp)
            if not item:
                raise TradeNotFound(f"Trade not found: {trade_id}")
            return TradeResponse(**item)
        except TradeNotFound:
            raise
        except Exception as e:
            logger.error(f"✗ Failed to get trade: {str(e)}")
            raise DatabaseException(f"Failed to get trade: {str(e)}")

    def get_all_trades(self, limit: int = 100, offset: int = 0) -> List[TradeResponse]:
        """Get all trades with pagination"""
        try:
            items = self.db.scan_all(limit=limit)
            trades = [TradeResponse(**item) for item in items]
            return trades
        except Exception as e:
            logger.error(f"✗ Failed to get all trades: {str(e)}")
            raise DatabaseException(f"Failed to get all trades: {str(e)}")

    def get_trades_by_date(self, date: str, limit: int = 100) -> List[TradeResponse]:
        """Get trades for a specific date"""
        try:
            items = self.db.query_by_date(date, limit=limit)
            trades = [TradeResponse(**item) for item in items]
            logger.info(f"✓ Retrieved {len(trades)} trades for date: {date}")
            return trades
        except Exception as e:
            logger.error(f"✗ Failed to get trades by date: {str(e)}")
            raise DatabaseException(f"Failed to get trades by date: {str(e)}")

    def get_trades_by_strategy(self, strategy: str, limit: int = 100) -> List[TradeResponse]:
        """Get trades for a specific strategy"""
        try:
            items = self.db.query_by_strategy(strategy, limit=limit)
            trades = [TradeResponse(**item) for item in items]
            logger.info(f"✓ Retrieved {len(trades)} trades for strategy: {strategy}")
            return trades
        except Exception as e:
            logger.error(f"✗ Failed to get trades by strategy: {str(e)}")
            raise DatabaseException(f"Failed to get trades by strategy: {str(e)}")

    def filter_trades(self, filter_request: TradeFilterRequest) -> List[TradeResponse]:
        """Filter trades based on criteria"""
        try:
            all_trades = self.get_all_trades(limit=1000)

            # Apply filters
            filtered_trades = all_trades

            if filter_request.start_date:
                filtered_trades = [t for t in filtered_trades if t.date >= filter_request.start_date]

            if filter_request.end_date:
                filtered_trades = [t for t in filtered_trades if t.date <= filter_request.end_date]

            if filter_request.strategy:
                filtered_trades = [t for t in filtered_trades if t.strategy == filter_request.strategy]

            if filter_request.position_type:
                filtered_trades = [t for t in filtered_trades if t.position_type == filter_request.position_type]

            if filter_request.only_profitable:
                filtered_trades = [t for t in filtered_trades if t.pnl > 0]

            # Sort by date descending
            filtered_trades.sort(key=lambda x: x.date, reverse=True)

            # Apply pagination
            paginated_trades = filtered_trades[filter_request.offset:filter_request.offset + filter_request.limit]

            logger.info(f"✓ Filtered {len(paginated_trades)} trades")
            return paginated_trades

        except Exception as e:
            logger.error(f"✗ Failed to filter trades: {str(e)}")
            raise DatabaseException(f"Failed to filter trades: {str(e)}")

    def upsert_trade(self, trade: TradeCreate) -> TradeResponse:
        """Create or update a trade — PostgreSQL upsert handles duplicates automatically"""
        try:
            return self.create_trade(trade)
        except Exception as e:
            logger.error(f"✗ Failed to upsert trade: {str(e)}")
            raise DatabaseException(f"Failed to upsert trade: {str(e)}")

    def delete_trade(self, trade_id: str, timestamp: str) -> bool:
        """Delete a trade"""
        try:
            self.db.delete_item(trade_id, timestamp)
            logger.info(f"✓ Trade deleted: {trade_id}")
            return True
        except Exception as e:
            logger.error(f"✗ Failed to delete trade: {str(e)}")
            raise DatabaseException(f"Failed to delete trade: {str(e)}")


# Global trade service instance
_trade_service: Optional[TradeService] = None


def get_trade_service() -> TradeService:
    """Get or create the trade service"""
    global _trade_service
    if _trade_service is None:
        _trade_service = TradeService()
    return _trade_service
