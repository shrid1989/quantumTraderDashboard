"""Trade routes for QuantumTrader Dashboard API"""
import os
from datetime import datetime

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException, status
from typing import List

from app.models import TradeResponse, TradeFilterRequest, TradeCreate
from app.services.trade_service import get_trade_service
from app.utils.logger import get_logger
from app.utils.exceptions import DatabaseException, TradeNotFound
from app.config import S3_BUCKET, S3_PREFIX

logger = get_logger()

# Create router
router = APIRouter(prefix="/api/trades", tags=["Trades"])

# Get trade service
trade_service = get_trade_service()


def _get_s3_client():
    """Create S3 client from environment credentials/role."""
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "ap-south-1"
    return boto3.client("s3", region_name=region)


def _candidate_keys_for_date(date: str) -> List[str]:
    """Build candidate S3 object keys for a date-based CSV file."""
    filename = f"trades_{date}.csv"
    prefix = (S3_PREFIX or "").strip("/")
    if prefix:
        return [f"{prefix}/{filename}", filename]
    return [filename]


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


@router.get("/date/{date}/download")
async def get_daily_csv_download(date: str):
    """
    Get a short-lived presigned download URL for a day CSV.

    Path parameters:
    - date: Date in format YYYY-MM-DD
    """
    try:
        # Validate date format early
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD",
        )

    s3_client = _get_s3_client()
    key_found = None

    for key in _candidate_keys_for_date(date):
        try:
            s3_client.head_object(Bucket=S3_BUCKET, Key=key)
            key_found = key
            break
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in {"404", "NoSuchKey", "NotFound"}:
                continue
            logger.error(f"✗ Failed to check S3 object {key}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to check CSV file in S3",
            )

    if not key_found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CSV file not found for {date}",
        )

    expires_in = int(os.getenv("S3_PRESIGNED_EXPIRY_SECONDS", "300"))

    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": S3_BUCKET,
                "Key": key_found,
                "ResponseContentDisposition": f'attachment; filename="trades_{date}.csv"',
                "ResponseContentType": "text/csv",
            },
            ExpiresIn=expires_in,
        )

        return {
            "date": date,
            "bucket": S3_BUCKET,
            "key": key_found,
            "download_url": url,
            "expires_in": expires_in,
        }
    except Exception as e:
        logger.error(f"✗ Failed to generate presigned URL for {date}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download URL",
        )
