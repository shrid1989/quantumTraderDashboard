// Dashboard Page with enhanced metrics and interactivity
import React, { useState, useEffect } from "react";
import { dashboardAPI, tradesAPI } from "../services/api";
import toast from "react-hot-toast";
import "../styles/dashboard.css";

function DashboardPage() {
  const [kpis, setKpis] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const kpiResponse = await dashboardAPI.getKPIs();
      setKpis(kpiResponse.data);

      const tradesResponse = await tradesAPI.getAllTrades(100);
      const trades = tradesResponse.data || [];
      setRecentTrades(trades.slice(0, 5));
    } catch (error) {
      toast.error("Failed to load dashboard data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success("Dashboard refreshed!");
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loader">
          <div className="spinner-circle"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const totalProfit = kpis?.total_pnl || 0;
  const profitableTradesCount = kpis?.profitable_trades || 0;
  const avgWinSize = kpis?.avg_win_size || 0;
  const avgLossSize = kpis?.avg_loss_size || 0;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>📊 Trading Dashboard</h1>
          <p className="subtitle">
            Real-time performance analytics for NIFTY trading strategies
          </p>
        </div>
        <button
          className={`refresh-btn ${refreshing ? "rotating" : ""}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          🔄
        </button>
      </div>

      {kpis && (
        <>
          {/* Key Metrics Section */}
          <div className="metrics-grid">
            {/* Primary KPI - Total P&L */}
            <div
              className="kpi-card primary-kpi"
              style={{
                borderColor:
                  totalProfit >= 0
                    ? "var(--accent-green)"
                    : "var(--accent-red)",
              }}
            >
              <div className="kpi-header">
                <h3>Total P&L</h3>
                <span className="kpi-icon">💰</span>
              </div>
              <p
                className="kpi-value"
                style={{
                  color:
                    totalProfit >= 0
                      ? "var(--accent-green)"
                      : "var(--accent-red)",
                }}
              >
                ₹{totalProfit.toFixed(2)}
              </p>
              <p className="kpi-detail">
                {totalProfit > 0 ? "📈" : totalProfit < 0 ? "📉" : "➡️"} Net
                profit/loss
              </p>
            </div>

            {/* Win Rate */}
            <div className="kpi-card accent-teal">
              <div className="kpi-header">
                <h3>Win Rate</h3>
                <span className="kpi-icon">🎯</span>
              </div>
              <p className="kpi-value">{kpis.win_rate.toFixed(2)}%</p>
              <p className="kpi-detail">
                {profitableTradesCount}/{kpis.total_trades} trades profitable
              </p>
            </div>

            {/* Total Trades */}
            <div className="kpi-card accent-blue">
              <div className="kpi-header">
                <h3>Total Trades</h3>
                <span className="kpi-icon">📋</span>
              </div>
              <p className="kpi-value">{kpis.total_trades}</p>
              <p className="kpi-detail">
                ✅ {profitableTradesCount} wins | ❌{" "}
                {kpis.total_trades - profitableTradesCount} losses
              </p>
            </div>

            {/* Profit Factor */}
            <div className="kpi-card accent-purple">
              <div className="kpi-header">
                <h3>Profit Factor</h3>
                <span className="kpi-icon">📊</span>
              </div>
              <p className="kpi-value">{kpis.profit_factor.toFixed(2)}</p>
              <p className="kpi-detail">
                Gross profit / Gross loss ratio
              </p>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="secondary-metrics">
            <div className="metric-item">
              <div className="metric-label">Avg Win Size</div>
              <div className="metric-value positive">
                ₹{avgWinSize.toFixed(2)}
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Avg Loss Size</div>
              <div className="metric-value negative">
                ₹{Math.abs(avgLossSize).toFixed(2)}
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Max Profit Trade</div>
              <div className="metric-value">
                ₹
                {recentTrades
                  .reduce((max, t) => Math.max(max, t.pnl), 0)
                  .toFixed(2)}
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Max Loss Trade</div>
              <div className="metric-value">
                ₹
                {recentTrades
                  .reduce((min, t) => Math.min(min, t.pnl), 0)
                  .toFixed(2)}
              </div>
            </div>
          </div>

          {/* Recent Trades Section */}
          {recentTrades.length > 0 && (
            <div className="recent-trades-section">
              <h2>📈 Recent Trades</h2>
              <div className="trades-mini-list">
                {recentTrades.map((trade, idx) => (
                  <div
                    key={idx}
                    className={`trade-mini-card ${
                      trade.pnl > 0 ? "profitable" : trade.pnl < 0 ? "loss" : ""
                    }`}
                  >
                    <div className="trade-mini-header">
                      <span className="trade-strategy">{trade.strategy}</span>
                      <span
                        className="trade-pnl"
                        style={{
                          color:
                            trade.pnl > 0
                              ? "var(--accent-green)"
                              : trade.pnl < 0
                              ? "var(--accent-red)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {trade.pnl > 0 ? "+" : ""}₹{trade.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="trade-mini-details">
                      <span className="trade-date">{trade.date}</span>
                      <span className="trade-position">{trade.position_type}</span>
                      <span className="trade-time">
                        {trade.entry_time} → {trade.exit_time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Summary */}
          <div className="performance-summary">
            <h2>📊 Performance Summary</h2>
            <div className="summary-grid">
              <div className="summary-box">
                <h4>Strategy Distribution</h4>
                <div className="strategies-list">
                  {/* Placeholder for strategy breakdown */}
                  <p className="placeholder-text">
                    📌 Analyzing strategy performance...
                  </p>
                </div>
              </div>
              <div className="summary-box">
                <h4>Timeline Stats</h4>
                <div className="timeline-stats">
                  <div className="stat-row">
                    <span>Today's Trades:</span>
                    <strong>
                      {recentTrades.length} / {kpis.total_trades}
                    </strong>
                  </div>
                  <div className="stat-row">
                    <span>Win/Loss Ratio:</span>
                    <strong>
                      {profitableTradesCount} : {kpis.total_trades - profitableTradesCount}
                    </strong>
                  </div>
                  <div className="stat-row">
                    <span>Profit Margin:</span>
                    <strong>
                      {kpis.total_trades > 0
                        ? (
                            (totalProfit /
                              (kpis.total_trades *
                                (avgWinSize > 0 ? avgWinSize : 100))) *
                            100
                          ).toFixed(2)
                        : "0"}
                      %
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPage;
