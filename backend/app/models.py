"""Pydantic models for QuantumTrader Dashboard API"""
from pydantic import BaseModel, Field, EmailStr
from datetime import date, time
from typing import Optional, List


# Authentication Models
class LoginRequest(BaseModel):
    email: str = Field(..., description="User email")
    password: str = Field(..., description="User password")


class LoginResponse(BaseModel):
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    user_email: str = Field(..., description="Logged in user email")


# Trade Models
class TradeBase(BaseModel):
    date: str = Field(..., description="Trade date (YYYY-MM-DD)")
    nifty_value: float = Field(..., description="NIFTY spot value at entry")
    strategy: str = Field(..., description="Strategy name")
    entry_reason: str = Field(..., description="Reason for entry")
    option_strike: int = Field(..., description="ATM strike price")
    sold_option: str = Field(..., description="Option symbol sold")
    position_type: str = Field(..., description="Position type (short_put, short_call, short_straddle)")
    entry_time: str = Field(..., description="Entry time (HH:MM:SS)")
    entry_premium: float = Field(..., description="Entry premium received")
    exit_time: str = Field(..., description="Exit time (HH:MM:SS)")
    exit_premium: float = Field(..., description="Exit premium paid")
    exit_reason: str = Field(..., description="Reason for exit")
    quantity: int = Field(default=1, description="Trade quantity")
    pnl: float = Field(..., description="Trade P&L")
    ce_symbol: Optional[str] = Field(None, description="CE option symbol (for straddles)")
    pe_symbol: Optional[str] = Field(None, description="PE option symbol (for straddles)")
    straddle_vwap: Optional[float] = Field(None, description="Straddle VWAP (for straddles)")


class TradeCreate(TradeBase):
    """Model for creating a trade"""
    pass


class TradeUpdate(BaseModel):
    """Model for updating a trade"""
    exit_time: Optional[str] = None
    exit_premium: Optional[float] = None
    exit_reason: Optional[str] = None
    pnl: Optional[float] = None


class TradeResponse(TradeBase):
    """Model for returning a trade"""
    trade_id: str = Field(..., description="Unique trade identifier")
    timestamp: str = Field(..., description="Trade timestamp")

    class Config:
        from_attributes = True


class TradeUpdateResponse(BaseModel):
    """Model for trade update response"""
    trade_id: str = Field(..., description="Trade ID")
    timestamp: str = Field(..., description="Timestamp of update")
    status: str = Field(..., description="Update status")
    message: str = Field(..., description="Status message")


# Filter Models
class TradeFilterRequest(BaseModel):
    start_date: Optional[str] = Field(None, description="Start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="End date (YYYY-MM-DD)")
    strategy: Optional[str] = Field(None, description="Filter by strategy")
    position_type: Optional[str] = Field(None, description="Filter by position type")
    only_profitable: Optional[bool] = Field(False, description="Only show profitable trades")
    limit: int = Field(default=20, description="Number of trades to return")
    offset: int = Field(default=0, description="Number of trades to skip")


# Dashboard Models
class KPIMetrics(BaseModel):
    total_pnl: float = Field(..., description="Total P&L")
    total_trades: int = Field(..., description="Total number of trades")
    winning_trades: int = Field(..., description="Number of winning trades")
    losing_trades: int = Field(..., description="Number of losing trades")
    win_rate: float = Field(..., description="Win rate percentage")
    profit_factor: float = Field(..., description="Profit factor (total wins / total losses)")
    largest_win: float = Field(..., description="Largest win")
    largest_loss: float = Field(..., description="Largest loss")
    average_win: float = Field(..., description="Average win per trade")
    average_loss: float = Field(..., description="Average loss per trade")


class DailyPnL(BaseModel):
    date: str = Field(..., description="Trade date")
    pnl: float = Field(..., description="Daily P&L")


class EquityCurveData(BaseModel):
    dates: List[str] = Field(..., description="List of dates")
    cumulative_pnl: List[float] = Field(..., description="Cumulative P&L values")
    daily_pnl: List[float] = Field(..., description="Daily P&L values")


class StrategyPerformance(BaseModel):
    strategy: str = Field(..., description="Strategy name")
    total_pnl: float = Field(..., description="Total P&L for strategy")
    total_trades: int = Field(..., description="Total trades for strategy")
    win_rate: float = Field(..., description="Win rate for strategy")
    average_win: float = Field(..., description="Average win for strategy")
    average_loss: float = Field(..., description="Average loss for strategy")
    max_win: float = Field(..., description="Largest win for strategy")
    max_loss: float = Field(..., description="Largest loss for strategy")
    sharpe_ratio: float = Field(..., description="Sharpe ratio for strategy")


# CSV Upload Models
class CSVUploadRequest(BaseModel):
    """Model for CSV upload metadata"""
    filename: str = Field(..., description="CSV filename")


class CSVUploadResponse(BaseModel):
    """Model for CSV upload response"""
    status: str = Field(..., description="Upload status")
    message: str = Field(..., description="Status message")
    trades_added: int = Field(..., description="Number of trades added")
    trades_updated: int = Field(..., description="Number of trades updated")
    errors: List[str] = Field(default_factory=list, description="List of errors if any")


# S3 Auto-Sync Models
class S3AutoSyncRequest(BaseModel):
    """Model for S3 auto-sync trigger (from Lambda)"""
    bucket: str = Field(..., description="S3 bucket name")
    key: str = Field(..., description="S3 object key (file path)")


class S3AutoSyncResponse(BaseModel):
    """Model for S3 auto-sync response"""
    status: str = Field(..., description="Sync status")
    message: str = Field(..., description="Status message")
    trades_added: int = Field(..., description="Number of trades added")
    trades_updated: int = Field(..., description="Number of trades updated")


# Error Response Model
class ErrorResponse(BaseModel):
    detail: str = Field(..., description="Error message")
    status_code: int = Field(..., description="HTTP status code")
