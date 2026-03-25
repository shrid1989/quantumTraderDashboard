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
    pivot: Optional[float] = Field(None, description="Pivot level")
    s1: Optional[float] = Field(None, description="Support 1")
    s2: Optional[float] = Field(None, description="Support 2")
    r1: Optional[float] = Field(None, description="Resistance 1")
    r2: Optional[float] = Field(None, description="Resistance 2")
    pnl_pts: Optional[float] = Field(None, description="PnL in points")
    trade_duration: Optional[str] = Field(None, description="Trade duration")

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


# ─── Backtest Models ──────────────────────────────────────────────────────────

class BacktestTradeCreate(BaseModel):
    """Single trade from a backtest CSV"""
    date: str
    position: str
    nifty_at_entry: float = 0
    entry_reason: str = ""
    entry_time: str = ""
    entry_price: float = 0
    exit_time: str = ""
    exit_price: float = 0
    exit_reason: str = ""
    pnl_pts: float = 0
    pnl_inr: float = 0
    trade_duration: str = ""
    pivot: Optional[float] = None
    r1: Optional[float] = None
    r2: Optional[float] = None
    s1: Optional[float] = None
    s2: Optional[float] = None


class BacktestSessionCreate(BaseModel):
    """Request body to save a backtest session"""
    session_name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    notes: str = ""
    strategy_name: str = ""
    tags: List[str] = []
    # Computed KPIs (sent from the frontend analytics engine)
    data_date_from: str = ""
    data_date_to: str = ""
    total_trades: int = 0
    net_pnl: float = 0
    win_rate: float = 0
    profit_factor: float = 0
    max_drawdown: float = 0
    sharpe_ratio: float = 0
    expectancy: float = 0
    risk_reward: float = 0
    max_win_streak: int = 0
    max_loss_streak: int = 0
    # Trades
    trades: List[BacktestTradeCreate] = []


class BacktestSessionSummary(BaseModel):
    """Session summary for list view (no trades)"""
    id: str
    session_name: str
    description: str = ""
    notes: str = ""
    strategy_name: str = ""
    data_date_from: Optional[str] = None
    data_date_to: Optional[str] = None
    total_trades: int = 0
    net_pnl: float = 0
    win_rate: float = 0
    profit_factor: float = 0
    max_drawdown: float = 0
    sharpe_ratio: float = 0
    expectancy: float = 0
    risk_reward: float = 0
    max_win_streak: int = 0
    max_loss_streak: int = 0
    tags: List[str] = []
    created_at: Optional[str] = None


class BacktestSessionDetail(BacktestSessionSummary):
    """Full session with trades"""
    trades: List[dict] = []


# ─── Strategy Scheduler Models ────────────────────────────────────────────────

class StrategySchedule(BaseModel):
    """1 row per strategy with active_days array"""
    id: Optional[str] = None
    strategy_name: str = Field(..., description="Strategy identifier")
    active_days: List[int] = Field(default=[0, 1, 2, 3, 4], description="Active day numbers: 0=Mon..4=Fri")
    updated_at: Optional[str] = None


class ScheduleUpdate(BaseModel):
    """Update a single strategy's active days"""
    strategy_name: str
    active_days: List[int] = Field(..., description="Array of active day numbers")


class ScheduleBulkUpdate(BaseModel):
    """Bulk update all strategies"""
    schedules: List[ScheduleUpdate]


class ScheduleOverrideCreate(BaseModel):
    """Create a date-specific override"""
    strategy_name: str
    specific_date: str = Field(..., description="YYYY-MM-DD")
    is_active: bool = Field(False, description="True=force-enable, False=force-disable")


class ScheduleOverride(BaseModel):
    """A date-specific override entry"""
    id: Optional[str] = None
    strategy_name: str
    specific_date: str
    is_active: bool
    updated_at: Optional[str] = None


class TodayActiveResponse(BaseModel):
    """Response for today's active strategies"""
    date: str
    day_of_week: int
    day_name: str
    active_strategies: List[str]


