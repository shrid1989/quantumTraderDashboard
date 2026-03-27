// Dashboard Page with enhanced metrics and interactivity
import React, { useState, useEffect } from "react";
import { tradesAPI } from "../services/api";
import toast from "react-hot-toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "../styles/dashboard.css";

// Color scheme for charts
const COLORS = ["#00897b", "#1976d2", "#f57c00", "#c62828", "#7b1fa2"];

function DashboardPage() {
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("metrics");
  const [timePeriod, setTimePeriod] = useState("month"); // all, day, week, month, year

  const fetchData = async () => {
    try {
      // Fetch all trades to drive the entire dashboard
      const tradesResponse = await tradesAPI.getAllTrades(500);
      const trades = tradesResponse.data || [];
      setAllTrades(trades);
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

  // Filter trades by time period
  const getFilteredTrades = (trades, period) => {
    const now = new Date();
    const tradeDate = (tradeStr) => new Date(tradeStr);

    return trades.filter((trade) => {
      const date = tradeDate(trade.date);
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      switch (period) {
        case "day":
          return diffDays <= 1;
        case "week":
          return diffDays <= 7;
        case "month":
          return diffDays <= 30;
        case "year":
          return diffDays <= 365;
        case "all":
        default:
          return true;
      }
    });
  };

  // Calculate KPIs for filtered trades
  const getFilteredKPIs = (trades) => {
    if (!trades || trades.length === 0) {
      return {
        total_pnl: 0,
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        win_rate: 0,
        profit_factor: 0,
        largest_win: 0,
        largest_loss: 0,
        average_win: 0,
        average_loss: 0,
      };
    }

    const total_pnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const winning_trades = trades.filter((t) => t.pnl > 0).length;
    const losing_trades = trades.filter((t) => t.pnl < 0).length;
    const total_trades = trades.length;
    const win_rate = (winning_trades / total_trades) * 100;
    const total_wins = trades
      .filter((t) => t.pnl > 0)
      .reduce((sum, t) => sum + t.pnl, 0);
    const total_losses = trades
      .filter((t) => t.pnl < 0)
      .reduce((sum, t) => sum + t.pnl, 0);
    const profit_factor =
      total_losses !== 0
        ? total_wins / Math.abs(total_losses)
        : total_wins > 0
          ? Infinity
          : 0;
    const largest_win = trades.reduce((max, t) => Math.max(max, t.pnl), 0);
    const largest_loss = trades.reduce((min, t) => Math.min(min, t.pnl), 0);
    const average_win = winning_trades > 0 ? total_wins / winning_trades : 0;
    const average_loss = losing_trades > 0 ? total_losses / losing_trades : 0;

    return {
      total_pnl,
      total_trades,
      winning_trades,
      losing_trades,
      win_rate,
      profit_factor,
      largest_win,
      largest_loss,
      average_win,
      average_loss,
    };
  };

  // Calculate strategy breakdown
  const getStrategyBreakdown = (trades) => {
    const breakdown = {};
    if (!trades) return [];
    trades.forEach((trade) => {
      if (!breakdown[trade.strategy]) {
        breakdown[trade.strategy] = { wins: 0, losses: 0, total: 0, pnl: 0 };
      }
      breakdown[trade.strategy].total += 1;
      breakdown[trade.strategy].pnl += trade.pnl;
      if (trade.pnl > 0) breakdown[trade.strategy].wins += 1;
      else if (trade.pnl < 0) breakdown[trade.strategy].losses += 1;
    });
    return Object.entries(breakdown).map(([name, data]) => ({
      name,
      ...data,
    }));
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

  // Get filtered trades and KPIs
  const filteredTrades = getFilteredTrades(allTrades, timePeriod);
  const filteredKPIs = getFilteredKPIs(filteredTrades);

  const totalProfit = filteredKPIs?.total_pnl || 0;
  const winningTrades = filteredKPIs?.winning_trades || 0;
  const avgWinSize = filteredKPIs?.average_win || 0;
  const avgLossSize = filteredKPIs?.average_loss || 0;
  const strategyBreakdown = getStrategyBreakdown(filteredTrades);

  // Derive charts from filteredTrades
  const equityCurveData = getEquityCurve(filteredTrades);
  const monthlyChartData = getMonthlyData(filteredTrades);

  // Get time period label
  const getTimePeriodLabel = () => {
    const labels = {
      all: "All Time",
      day: "Today",
      week: "This Week",
      month: "This Month",
      year: "This Year",
    };
    return labels[timePeriod] || "All Time";
  };

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
          title="Refresh dashboard data"
        >
          🔄
        </button>
      </div>

      {/* Time Period Filter */}
      <div className="time-period-filter">
        <span className="filter-label">Performance Period:</span>
        <div className="filter-buttons">
          {["day", "week", "month", "year", "all"].map((period) => (
            <button
              key={period}
              className={`filter-btn ${timePeriod === period ? "active" : ""}`}
              onClick={() => setTimePeriod(period)}
            >
              {period === "all"
                ? "All Time"
                : period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
        <span className="period-display">{getTimePeriodLabel()}</span>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-container">
        <button
          className={`tab ${activeTab === "metrics" ? "active" : ""}`}
          onClick={() => setActiveTab("metrics")}
        >
          📈 Key Metrics
        </button>
        <button
          className={`tab ${activeTab === "charts" ? "active" : ""}`}
          onClick={() => setActiveTab("charts")}
        >
          📊 Charts
        </button>
        <button
          className={`tab ${activeTab === "trades" ? "active" : ""}`}
          onClick={() => setActiveTab("trades")}
        >
          📋 Recent Trades ({filteredTrades.length})
        </button>
      </div>

      {filteredKPIs && (
        <>
          {/* METRICS TAB */}
          {activeTab === "metrics" && (
            <div className="tab-content">
              {/* Primary KPI Cards */}
              <div className="metrics-grid">
                {/* Total P&L */}
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
                  <div className="kpi-progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(
                          (totalProfit / (avgWinSize * 10 || 1)) * 100,
                          100,
                        )}%`,
                        backgroundColor:
                          totalProfit >= 0
                            ? "var(--accent-green)"
                            : "var(--accent-red)",
                      }}
                    />
                  </div>
                </div>

                {/* Win Rate */}
                <div className="kpi-card accent-teal">
                  <div className="kpi-header">
                    <h3>Win Rate</h3>
                    <span className="kpi-icon">🎯</span>
                  </div>
                  <p className="kpi-value">{filteredKPIs.win_rate.toFixed(2)}%</p>
                  <p className="kpi-detail">
                    {winningTrades}/{filteredKPIs.total_trades} trades profitable
                  </p>
                  <div className="kpi-progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${filteredKPIs.win_rate}%`,
                        backgroundColor: "var(--accent-teal)",
                      }}
                    />
                  </div>
                </div>

                {/* Total Trades */}
                <div className="kpi-card accent-blue">
                  <div className="kpi-header">
                    <h3>Total Trades</h3>
                    <span className="kpi-icon">📋</span>
                  </div>
                  <p className="kpi-value">{filteredKPIs.total_trades}</p>
                  <p className="kpi-detail">
                    ✅ {winningTrades} wins | ❌{" "}
                    {filteredKPIs.total_trades - winningTrades} losses
                  </p>
                  <div className="kpi-breakdown">
                    <span className="breakdown-item">
                      <span className="dot green"></span> Wins
                    </span>
                    <span className="breakdown-item">
                      <span className="dot red"></span> Losses
                    </span>
                  </div>
                </div>

                {/* Profit Factor */}
                <div className="kpi-card accent-purple">
                  <div className="kpi-header">
                    <h3>Profit Factor</h3>
                    <span className="kpi-icon">📊</span>
                  </div>
                  <p className="kpi-value">{filteredKPIs.profit_factor.toFixed(2)}</p>
                  <p className="kpi-detail">Gross profit / Gross loss ratio</p>
                  <div className="kpi-status">
                    {filteredKPIs.profit_factor > 2 && (
                      <span className="status-badge excellent">
                        ✨ Excellent
                      </span>
                    )}
                    {filteredKPIs.profit_factor > 1 && filteredKPIs.profit_factor <= 2 && (
                      <span className="status-badge good">👍 Good</span>
                    )}
                    {filteredKPIs.profit_factor <= 1 && (
                      <span className="status-badge warning">⚠️ Monitor</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Secondary Metrics Grid */}
              <div className="secondary-metrics">
                <div className="metric-item">
                  <div className="metric-label">Avg Win</div>
                  <div className="metric-value positive">
                    ₹{avgWinSize.toFixed(2)}
                  </div>
                  <div className="metric-mini-label">
                    {winningTrades > 0
                      ? (avgWinSize * winningTrades).toFixed(0)
                      : 0}{" "}
                    total
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">Avg Loss</div>
                  <div className="metric-value negative">
                    ₹{Math.abs(avgLossSize).toFixed(2)}
                  </div>
                  <div className="metric-mini-label">
                    {filteredKPIs.total_trades - winningTrades > 0
                      ? (
                        avgLossSize *
                        (filteredKPIs.total_trades - winningTrades)
                      ).toFixed(0)
                      : 0}{" "}
                    total
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">Largest Win</div>
                  <div className="metric-value">
                    ₹{filteredKPIs.largest_win.toFixed(2)}
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">Largest Loss</div>
                  <div className="metric-value">
                    ₹{filteredKPIs.largest_loss.toFixed(2)}
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">Consecutive Wins</div>
                  <div className="metric-value">
                    {filteredTrades.length > 0 ? calculateConsecutiveWins(filteredTrades) : 0}
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-label">Consecutive Losses</div>
                  <div className="metric-value">
                    {filteredTrades.length > 0 ? calculateConsecutiveLosses(filteredTrades) : 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CHARTS TAB */}
          {activeTab === "charts" && (
            <div className="tab-content charts-content">
              {/* Equity Curve Chart */}
              {equityCurveData && equityCurveData.length > 0 && (
                <div className="chart-container">
                  <h2>📈 Equity Curve</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={equityCurveData}
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1a1a1a",
                          border: "1px solid #00897b",
                        }}
                        formatter={(value) => `₹${value.toFixed(2)}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="pnl"
                        stroke="#00897b"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Monthly PnL Chart */}
              {monthlyChartData && monthlyChartData.length > 0 && (
                <div className="chart-container">
                  <h2>📊 Monthly P&L Breakdown</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1a1a1a",
                          border: "1px solid #1976d2",
                        }}
                        formatter={(value) => `₹${value.toFixed(2)}`}
                      />
                      <Bar
                        dataKey="pnl"
                        fill="#1976d2"
                        radius={[6, 6, 0, 0]}
                        isAnimationActive={true}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Strategy Breakdown - Pie Chart */}
              {strategyBreakdown.length > 0 && (
                <div className="chart-container">
                  <h2>🎯 Strategy Performance</h2>
                  <div className="strategy-charts">
                    <div className="pie-chart-wrapper">
                      <h3>Win Distribution</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={strategyBreakdown}
                            dataKey="wins"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                            isAnimationActive={true}
                          >
                            {strategyBreakdown.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="strategy-stats">
                      <h3>Strategy Details</h3>
                      {strategyBreakdown.map((strategy, idx) => (
                        <div key={idx} className="strategy-stat-row">
                          <div className="strategy-name">
                            <span
                              className="color-dot"
                              style={{
                                backgroundColor: COLORS[idx % COLORS.length],
                              }}
                            ></span>
                            {strategy.name}
                          </div>
                          <div className="strategy-metrics">
                            <span className="stat">
                              P&L: ₹{strategy.pnl.toFixed(2)}
                            </span>
                            <span className="stat">
                              {strategy.total} trades ({strategy.wins}W /
                              {strategy.losses}L)
                            </span>
                            <span className="stat">
                              {strategy.total > 0
                                ? (
                                  (strategy.wins / strategy.total) *
                                  100
                                ).toFixed(1)
                                : 0}
                              %
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TRADES TAB */}
          {activeTab === "trades" && (
            <div className="tab-content">
              {filteredTrades.length > 0 ? (
                <div className="recent-trades-section">
                  <h2>📈 Recent Trades ({filteredTrades.length})</h2>
                  <div className="trades-list-enhanced">
                    {filteredTrades.slice(0, 20).map((trade, idx) => (
                      <div
                        key={idx}
                        className={`trade-card-enhanced ${trade.pnl > 0
                            ? "profitable"
                            : trade.pnl < 0
                              ? "loss"
                              : ""
                          }`}
                      >
                        <div className="trade-card-header">
                          <span className="trade-strategy">
                            {trade.strategy}
                          </span>
                          <span className="trade-date">{trade.date}</span>
                        </div>
                        <div className="trade-card-body">
                          <div className="trade-info">
                            <div className="trade-field">
                              <label>Position</label>
                              <span>{trade.position_type}</span>
                            </div>
                            <div className="trade-field">
                              <label>Entry</label>
                              <span>
                                {trade.entry_time} @ ₹
                                {trade.entry_premium?.toFixed(2) || "N/A"}
                              </span>
                            </div>
                            <div className="trade-field">
                              <label>Exit</label>
                              <span>
                                {trade.exit_time} @ ₹
                                {trade.exit_premium?.toFixed(2) || "N/A"}
                              </span>
                            </div>
                          </div>
                          <div className="trade-pnl-section">
                            <span
                              className="trade-pnl-large"
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
                            <span className="trade-qty">
                              Qty: {trade.quantity}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <p>📭 No trades yet</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Helper function to calculate consecutive wins
function calculateConsecutiveWins(trades) {
  if (!trades || trades.length === 0) return 0;
  let maxConsecutive = 0;
  let currentConsecutive = 0;

  // Sort trades ascending by date
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const trade of sortedTrades) {
    if (trade.pnl > 0) {
      currentConsecutive++;
      if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
    } else if (trade.pnl < 0) {
      currentConsecutive = 0;
    }
  }
  return maxConsecutive;
}

// Helper function to calculate consecutive losses
function calculateConsecutiveLosses(trades) {
  if (!trades || trades.length === 0) return 0;
  let maxConsecutive = 0;
  let currentConsecutive = 0;

  // Sort trades ascending by date
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const trade of sortedTrades) {
    if (trade.pnl < 0) {
      currentConsecutive++;
      if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
    } else if (trade.pnl > 0) {
      currentConsecutive = 0;
    }
  }
  return maxConsecutive;
}

// Chart Helper: Calculate Equity Curve dynamically
function getEquityCurve(trades) {
  if (!trades || trades.length === 0) return [];
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  let runningPnl = 0;
  return sorted.map(t => {
    runningPnl += t.pnl;
    return {
      date: t.date ? t.date.slice(5, 10) : "", // MM-DD
      pnl: runningPnl
    };
  });
}

// Chart Helper: Calculate Monthly PnL dynamically
function getMonthlyData(trades) {
  if (!trades || trades.length === 0) return [];
  const byMonth = {};
  trades.forEach(t => {
    if (!t.date) return;
    const month = t.date.slice(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = 0;
    byMonth[month] += t.pnl;
  });
  return Object.entries(byMonth)
    .map(([month, pnl]) => ({
      month: month.slice(5), // Make it MM
      pnl
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export default DashboardPage;
