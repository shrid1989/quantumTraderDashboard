"""Dashboard routes for QuantumTrader Dashboard API"""
from fastapi import APIRouter, HTTPException, status

from app.models import KPIMetrics, EquityCurveData
from app.services.trade_service import get_trade_service
from app.services.metrics_service import MetricsService
from app.utils.logger import get_logger
from app.utils.exceptions import DatabaseException

logger = get_logger()

# Create router
router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

# Get services
trade_service = get_trade_service()
metrics_service = MetricsService()


@router.get("/kpis", response_model=KPIMetrics)
async def get_kpis():
    """
    Get KPI metrics for the dashboard

    Returns:
    - total_pnl: Total profit/loss
    - win_rate: Percentage of winning trades
    - total_trades: Total number of trades
    - profit_factor: Ratio of wins to losses
    - largest_win: Largest single win
    - largest_loss: Largest single loss
    """
    try:
        # Fetch all trades
        trades = trade_service.get_all_trades(limit=1000)

        # Calculate KPIs
        kpis = metrics_service.calculate_kpis(trades)
        logger.info(f"✓ KPI metrics returned: {kpis.total_trades} trades, {kpis.win_rate}% win rate")

        return kpis

    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.error(f"✗ Failed to get KPIs: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to calculate KPIs")


@router.get("/chart-data", response_model=EquityCurveData)
async def get_chart_data():
    """
    Get equity curve data for dashboard charts

    Returns:
    - dates: List of dates
    - cumulative_pnl: Cumulative PnL at each date
    - daily_pnl: Daily PnL for each date
    """
    try:
        # Fetch all trades
        trades = trade_service.get_all_trades(limit=1000)

        # Calculate equity curve
        equity_curve = metrics_service.calculate_equity_curve(trades)
        logger.info(f"✓ Equity curve data returned with {len(equity_curve.dates)} data points")

        return equity_curve

    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.error(f"✗ Failed to get chart data: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get chart data")


@router.get("/monthly-pnl")
async def get_monthly_pnl():
    """
    Get monthly P&L breakdown

    Returns dict: Monthly P&L values
    """
    try:
        # Fetch all trades
        trades = trade_service.get_all_trades(limit=1000)

        # Calculate monthly PnL
        monthly_pnl = metrics_service.get_monthly_pnl(trades)
        logger.info(f"✓ Monthly PnL returned for {len(monthly_pnl)} months")

        return {"monthly_pnl": monthly_pnl}

    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.error(f"✗ Failed to get monthly PnL: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get monthly PnL")


@router.get("/summary")
async def get_summary():
    """
    Get summary information for dashboard

    Returns:
    - total_trades: Total number of trades
    - strategies: List of strategies
    - latest_trade_date: Date of most recent trade
    """
    try:
        # Fetch all trades
        trades = trade_service.get_all_trades(limit=1000)

        if not trades:
            return {
                "total_trades": 0,
                "strategies": [],
                "latest_trade_date": None,
            }

        # Get strategies
        strategies = metrics_service.get_all_strategies(trades)

        # Get latest trade date
        latest_date = max(t.date for t in trades)

        logger.info(f"✓ Dashboard summary returned")

        return {
            "total_trades": len(trades),
            "strategies": strategies,
            "latest_trade_date": latest_date,
        }

    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.error(f"✗ Failed to get summary: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get summary")
