"""Metrics service for QuantumTrader Dashboard API"""
from typing import List, Dict, Tuple
import statistics

from app.models import TradeResponse, KPIMetrics, DailyPnL, EquityCurveData, StrategyPerformance
from app.utils.logger import get_logger

logger = get_logger()


class MetricsService:
    """Service for calculating trading metrics and KPIs"""

    @staticmethod
    def calculate_kpis(trades: List[TradeResponse]) -> KPIMetrics:
        """Calculate all KPI metrics from trades"""
        if not trades:
            return KPIMetrics(
                total_pnl=0.0,
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                win_rate=0.0,
                profit_factor=0.0,
                largest_win=0.0,
                largest_loss=0.0,
                average_win=0.0,
                average_loss=0.0,
            )

        # Calculate basic metrics
        total_pnl = sum(trade.pnl for trade in trades)
        total_trades = len(trades)

        # Separate wins and losses
        winning_trades = [t for t in trades if t.pnl > 0]
        losing_trades = [t for t in trades if t.pnl < 0]
        break_even_trades = [t for t in trades if t.pnl == 0]

        num_winners = len(winning_trades)
        num_losers = len(losing_trades)

        # Win rate
        win_rate = (num_winners / total_trades * 100) if total_trades > 0 else 0.0

        # Win/Loss amounts
        total_wins = sum(t.pnl for t in winning_trades) if winning_trades else 0.0
        total_losses = abs(sum(t.pnl for t in losing_trades)) if losing_trades else 0.0

        # Profit factor
        profit_factor = (total_wins / total_losses) if total_losses > 0 else (1.0 if total_wins > 0 else 0.0)

        # Largest win/loss
        largest_win = max([t.pnl for t in winning_trades]) if winning_trades else 0.0
        largest_loss = min([t.pnl for t in losing_trades]) if losing_trades else 0.0

        # Average win/loss
        avg_win = (total_wins / num_winners) if num_winners > 0 else 0.0
        avg_loss = (total_losses / num_losers) if num_losers > 0 else 0.0

        logger.info(f"✓ KPIs calculated: PnL={total_pnl}, Win Rate={win_rate:.1f}%, Trades={total_trades}")

        return KPIMetrics(
            total_pnl=total_pnl,
            total_trades=total_trades,
            winning_trades=num_winners,
            losing_trades=num_losers,
            win_rate=round(win_rate, 2),
            profit_factor=round(profit_factor, 2),
            largest_win=round(largest_win, 2),
            largest_loss=round(largest_loss, 2),
            average_win=round(avg_win, 2),
            average_loss=round(avg_loss, 2),
        )

    @staticmethod
    def calculate_daily_pnl(trades: List[TradeResponse]) -> List[DailyPnL]:
        """Calculate daily P&L from trades"""
        if not trades:
            return []

        # Group trades by date
        daily_totals: Dict[str, float] = {}
        for trade in trades:
            date = trade.date
            daily_totals[date] = daily_totals.get(date, 0.0) + trade.pnl

        # Sort by date
        daily_pnl = [
            DailyPnL(date=date, pnl=round(pnl, 2))
            for date, pnl in sorted(daily_totals.items())
        ]

        logger.info(f"✓ Daily PnL calculated for {len(daily_pnl)} days")
        return daily_pnl

    @staticmethod
    def calculate_equity_curve(trades: List[TradeResponse]) -> EquityCurveData:
        """Calculate equity curve (cumulative P&L over time)"""
        if not trades:
            return EquityCurveData(dates=[], cumulative_pnl=[], daily_pnl=[])

        # Get daily PnL
        daily_pnl_list = MetricsService.calculate_daily_pnl(trades)

        if not daily_pnl_list:
            return EquityCurveData(dates=[], cumulative_pnl=[], daily_pnl=[])

        # Calculate cumulative PnL
        dates = []
        daily_pnls = []
        cumulative_pnl = []
        running_total = 0.0

        for day in daily_pnl_list:
            dates.append(day.date)
            daily_pnls.append(day.pnl)
            running_total += day.pnl
            cumulative_pnl.append(round(running_total, 2))

        logger.info(f"✓ Equity curve calculated with {len(dates)} data points")

        return EquityCurveData(
            dates=dates,
            daily_pnl=daily_pnls,
            cumulative_pnl=cumulative_pnl,
        )

    @staticmethod
    def calculate_sharpe_ratio(trades: List[TradeResponse], risk_free_rate: float = 0.05) -> float:
        """Calculate Sharpe ratio for trades"""
        if len(trades) < 2:
            return 0.0

        daily_pnl_list = MetricsService.calculate_daily_pnl(trades)
        if not daily_pnl_list:
            return 0.0

        pnls = [day.pnl for day in daily_pnl_list]

        # Calculate returns
        mean_return = statistics.mean(pnls) if pnls else 0.0
        std_dev = statistics.stdev(pnls) if len(pnls) > 1 else 0.0

        # Sharpe ratio = (mean return - risk free rate) / std dev
        if std_dev == 0:
            return 0.0

        sharpe_ratio = (mean_return - risk_free_rate) / std_dev
        logger.info(f"✓ Sharpe ratio calculated: {sharpe_ratio:.2f}")
        return round(sharpe_ratio, 2)

    @staticmethod
    def calculate_strategy_performance(trades: List[TradeResponse], strategy: str) -> StrategyPerformance:
        """Calculate performance metrics for a specific strategy"""
        # Filter trades for strategy
        strategy_trades = [t for t in trades if t.strategy == strategy]

        if not strategy_trades:
            return StrategyPerformance(
                strategy=strategy,
                total_pnl=0.0,
                total_trades=0,
                win_rate=0.0,
                average_win=0.0,
                average_loss=0.0,
                max_win=0.0,
                max_loss=0.0,
                sharpe_ratio=0.0,
            )

        # Calculate metrics
        kpis = MetricsService.calculate_kpis(strategy_trades)
        sharpe = MetricsService.calculate_sharpe_ratio(strategy_trades)

        logger.info(f"✓ Strategy performance calculated for {strategy}: {kpis.total_trades} trades, {kpis.win_rate}% win rate")

        return StrategyPerformance(
            strategy=strategy,
            total_pnl=kpis.total_pnl,
            total_trades=kpis.total_trades,
            win_rate=kpis.win_rate,
            average_win=kpis.average_win,
            average_loss=kpis.average_loss,
            max_win=kpis.largest_win,
            max_loss=kpis.largest_loss,
            sharpe_ratio=sharpe,
        )

    @staticmethod
    def get_all_strategies(trades: List[TradeResponse]) -> List[str]:
        """Get list of all unique strategies"""
        strategies = list(set(t.strategy for t in trades))
        return sorted(strategies)

    @staticmethod
    def get_monthly_pnl(trades: List[TradeResponse]) -> Dict[str, float]:
        """Calculate monthly P&L breakdown"""
        monthly_totals: Dict[str, float] = {}

        for trade in trades:
            # Extract YYYY-MM from date
            month_key = trade.date[:7]  # First 7 characters of YYYY-MM-DD
            monthly_totals[month_key] = monthly_totals.get(month_key, 0.0) + trade.pnl

        # Sort by month
        monthly_pnl = {month: round(pnl, 2) for month, pnl in sorted(monthly_totals.items())}
        logger.info(f"✓ Monthly PnL calculated for {len(monthly_pnl)} months")
        return monthly_pnl


def get_metrics_service() -> MetricsService:
    """Get the metrics service (static class)"""
    return MetricsService()
