"""Trade routes for QuantumTrader Dashboard API"""
from fastapi import APIRouter, HTTPException, status
from typing import List

from app.models import TradeResponse, TradeFilterRequest, TradeCreate
from app.services.trade_service import get_trade_service
from app.utils.logger import get_logger
from app.utils.exceptions import DatabaseException, TradeNotFound

logger = get_logger()

# Create router
router = APIRouter(prefix="/api/trades", tags=["Trades"])

# Get trade service
trade_service = get_trade_service()


@router.get("/", response_model=List[TradeResponse])
async def get_trades(limit: int = 20, offset: int = 0):
    """
    Get all trades with pagination

    Query parameters:
    - limit: Number of trades to return (default: 20)
    - offset: Number of trades to skip (default: 0)
    """
    try:
        trades = trade_service.get_all_trades(limit=limit, offset=offset)
        logger.info(f"✓ Retrieved {len(trades)} trades")
        return trades
    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/date/{date}", response_model=List[TradeResponse])
async def get_trades_by_date(date: str):
    """
    Get trades for a specific date

    Path parameters:
    - date: Date in format YYYY-MM-DD
    """
    try:
        trades = trade_service.get_trades_by_date(date)
        logger.info(f"✓ Retrieved {len(trades)} trades for date {date}")
        return trades
    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/strategy/{strategy}", response_model=List[TradeResponse])
async def get_trades_by_strategy(strategy: str):
    """
    Get trades for a specific strategy

    Path parameters:
    - strategy: Strategy name (e.g., 'reversal_pivot_supertrend', 'short_straddle_vwap')
    """
    try:
        trades = trade_service.get_trades_by_strategy(strategy)
        logger.info(f"✓ Retrieved {len(trades)} trades for strategy {strategy}")
        return trades
    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/filter", response_model=List[TradeResponse])
async def filter_trades(filter_request: TradeFilterRequest):
    """
    Filter trades based on criteria

    Filter criteria:
    - start_date: Start date (YYYY-MM-DD)
    - end_date: End date (YYYY-MM-DD)
    - strategy: Strategy name
    - position_type: Position type (short_put, short_call, short_straddle)
    - only_profitable: Only return profitable trades
    - limit: Number of results (default: 20)
    - offset: Pagination offset (default: 0)
    """
    try:
        trades = trade_service.filter_trades(filter_request)
        logger.info(f"✓ Filtered and retrieved {len(trades)} trades")
        return trades
    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/", response_model=TradeResponse)
async def create_trade(trade: TradeCreate):
    """
    Create a new trade

    Request body:
    - All trade fields (date, nifty_value, strategy, entry_reason, etc.)
    """
    try:
        created_trade = trade_service.create_trade(trade)
        logger.info(f"✓ Created trade with PnL: {trade.pnl}")
        return created_trade
    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{trade_id}")
async def delete_trade(trade_id: str, timestamp: str):
    """
    Delete a trade

    Path parameters:
    - trade_id: Trade ID
    - timestamp: Trade timestamp (query parameter)
    """
    try:
        trade_service.delete_trade(trade_id, timestamp)
        logger.info(f"✓ Deleted trade: {trade_id}")
        return {"message": "Trade deleted successfully"}
    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except TradeNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
