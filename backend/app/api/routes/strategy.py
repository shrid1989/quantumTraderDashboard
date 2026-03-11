"""Strategy routes for QuantumTrader Dashboard API"""
from fastapi import APIRouter, HTTPException, status
from typing import List

from app.models import StrategyPerformance
from app.services.trade_service import get_trade_service
from app.services.metrics_service import MetricsService
from app.utils.logger import get_logger
from app.utils.exceptions import DatabaseException

logger = get_logger()

# Create router
router = APIRouter(prefix="/api/strategy", tags=["Strategy"])

# Get services
trade_service = get_trade_service()
metrics_service = MetricsService()


@router.get("/", response_model=List[str])
async def get_strategies_list():
    """
    Get list of all strategies used in trades

    Returns:
    - List of strategy names
    """
    try:
        # Fetch all trades - use higher limit to get all trades
        trades = trade_service.get_all_trades(limit=5000)
        logger.info(f"📊 Fetched {len(trades)} total trades for strategies list")

        # Get unique strategies
        strategies = metrics_service.get_all_strategies(trades)
        logger.info(f"✓ Strategies list returned: {len(strategies)} strategies - {strategies}")

        return strategies

    except DatabaseException as e:
        logger.error(f"✗ Database error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.error(f"✗ Failed to get strategies list: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get strategies list")


@router.get("/all/performance", response_model=List[StrategyPerformance])
async def get_all_strategies_performance():
    """
    Get performance metrics for all strategies

    Returns:
    - List of StrategyPerformance objects, one for each strategy
    """
    try:
        # Fetch all trades - use higher limit to get all trades
        trades = trade_service.get_all_trades(limit=5000)
        logger.info(f"📊 Fetched {len(trades)} total trades for strategy analysis")

        if not trades:
            logger.warning("⚠️ No trades found in database")
            return []

        # Get all strategies
        strategies = metrics_service.get_all_strategies(trades)
        logger.info(f"📊 Found {len(strategies)} unique strategies: {strategies}")

        # Calculate performance for each strategy
        performances = []
        for strategy in strategies:
            performance = metrics_service.calculate_strategy_performance(trades, strategy)
            performances.append(performance)
            logger.info(f"✓ Strategy performance calculated for {strategy}: {performance.total_trades} trades")

        logger.info(f"✓ Performance returned for {len(strategies)} strategies")
        return performances

    except DatabaseException as e:
        logger.error(f"✗ Database error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.error(f"✗ Failed to get all strategies performance: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get strategies performance")


@router.get("/{strategy}/performance", response_model=StrategyPerformance)
async def get_strategy_performance(strategy: str):
    """
    Get performance metrics for a specific strategy

    Path parameters:
    - strategy: Strategy name (e.g., 'reversal_pivot_supertrend', 'short_straddle_vwap')

    Returns:
    - total_pnl: Total P&L for strategy
    - win_rate: Win rate percentage
    - average_win: Average win per trade
    - average_loss: Average loss per trade
    - sharpe_ratio: Sharpe ratio
    """
    try:
        # Fetch all trades - use higher limit to get all trades
        trades = trade_service.get_all_trades(limit=5000)
        logger.info(f"📊 Fetched {len(trades)} total trades for strategy: {strategy}")

        # Calculate strategy performance
        performance = metrics_service.calculate_strategy_performance(trades, strategy)
        logger.info(f"✓ Strategy performance returned for {strategy}: {performance.total_trades} trades")

        return performance

    except DatabaseException as e:
        logger.error(f"✗ Database error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.error(f"✗ Failed to get strategy performance: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get strategy performance")


@router.get("/{strategy}/comparison")
async def compare_strategies():
    """
    Compare all strategies side-by-side

    Returns:
    - Dictionary with all strategies and their metrics for comparison
    """
    try:
        # Fetch all trades
        trades = trade_service.get_all_trades(limit=1000)

        if not trades:
            return {"strategies": []}

        # Get all strategies
        strategies = metrics_service.get_all_strategies(trades)

        # Calculate performance for each strategy
        comparison = {}
        for strategy in strategies:
            performance = metrics_service.calculate_strategy_performance(trades, strategy)
            comparison[strategy] = performance.dict()

        logger.info(f"✓ Strategy comparison returned for {len(strategies)} strategies")
        return {"strategies": comparison}

    except DatabaseException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.error(f"✗ Failed to compare strategies: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to compare strategies")
