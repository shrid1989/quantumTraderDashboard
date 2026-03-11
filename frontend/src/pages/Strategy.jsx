// Strategy Performance Page
import React, { useEffect, useState } from "react";
import { strategyAPI } from "../services/api";
import "../styles/strategy.css";

function StrategyPage() {
  const [strategies, setStrategies] = useState([]);
  const [performances, setPerformances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [viewMode, setViewMode] = useState("overview"); // overview or compare

  // Fetch all strategies and their performance
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get strategies list
        const strategiesList = await strategyAPI.getStrategies();
        console.log("Raw strategiesList response:", strategiesList);

        // Get all performance data
        const performanceData = await strategyAPI.getAllStrategiesPerformance();
        console.log("Raw performanceData response:", performanceData);

        // Handle axios response structure - data can be direct or nested
        const strategiesArray = Array.isArray(strategiesList.data)
          ? strategiesList.data
          : strategiesList.data?.data || [];
        const performancesArray = Array.isArray(performanceData.data)
          ? performanceData.data
          : performanceData.data?.data || [];

        setStrategies(strategiesArray);
        setPerformances(performancesArray);

        // Log for debugging
        console.log("Strategies:", strategiesArray);
        console.log("Performances:", performancesArray);
      } catch (err) {
        console.error("Error fetching strategies:", err);
        setError(
          err.response?.data?.detail ||
            "Failed to fetch strategy data. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Toggle strategy selection for comparison
  const toggleStrategySelection = (strategyName) => {
    setSelectedStrategies((prev) =>
      prev.includes(strategyName)
        ? prev.filter((s) => s !== strategyName)
        : [...prev, strategyName],
    );
  };

  // Get performance data for a specific strategy
  const getStrategyPerformance = (strategyName) => {
    return performances.find((p) => p.strategy === strategyName);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="loader">
        <div className="spinner-circle"></div>
        <p>Loading Strategy Data...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="strategy-page">
        <div className="error-container">
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <button
            className="retry-btn"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No strategies found
  if (!Array.isArray(performances) || performances.length === 0) {
    return (
      <div className="strategy-page">
        <div className="empty-state">
          <h2>📊 No Strategy Data</h2>
          <p>Upload trades to see strategy performance analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="strategy-page">
      {/* Header */}
      <div className="strategy-header">
        <div className="header-content">
          <h1>📊 Strategy Performance</h1>
          <p className="subtitle">
            Analyze and compare trading strategy performance metrics
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="view-mode-tabs">
          <button
            className={`tab-btn ${viewMode === "overview" ? "active" : ""}`}
            onClick={() => setViewMode("overview")}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${viewMode === "compare" ? "active" : ""}`}
            onClick={() => setViewMode("compare")}
          >
            Compare
          </button>
        </div>
      </div>

      {/* Overview Mode */}
      {viewMode === "overview" && (
        <div className="strategies-grid">
          {Array.isArray(performances) &&
            performances.map((performance) => (
              <StrategyCard
                key={performance.strategy}
                performance={performance}
              />
            ))}
        </div>
      )}

      {/* Compare Mode */}
      {viewMode === "compare" && (
        <div className="compare-container">
          {/* Selection Panel */}
          <div className="selection-panel">
            <h3>Select Strategies to Compare</h3>
            <div className="strategies-checklist">
              {Array.isArray(performances) &&
                performances.map((performance) => (
                  <label key={performance.strategy} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedStrategies.includes(
                        performance.strategy,
                      )}
                      onChange={() =>
                        toggleStrategySelection(performance.strategy)
                      }
                    />
                    <span>{formatStrategyName(performance.strategy)}</span>
                  </label>
                ))}
            </div>
          </div>

          {/* Comparison Table */}
          {selectedStrategies.length > 0 && (
            <div className="comparison-table-container">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {selectedStrategies.map((strategy) => (
                      <th key={strategy}>{formatStrategyName(strategy)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    "total_trades",
                    "total_pnl",
                    "win_rate",
                    "average_win",
                    "average_loss",
                    "max_win",
                    "max_loss",
                    "sharpe_ratio",
                  ].map((metric) => (
                    <tr key={metric}>
                      <td className="metric-name">
                        {formatMetricName(metric)}
                      </td>
                      {selectedStrategies.map((strategy) => {
                        const perf = getStrategyPerformance(strategy);
                        const value = formatMetricValue(perf[metric], metric);
                        return (
                          <td
                            key={`${strategy}-${metric}`}
                            className={`metric-value ${getMetricColor(
                              metric,
                              perf[metric],
                            )}`}
                          >
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedStrategies.length === 0 && (
            <div className="no-selection">
              <p>Select strategies above to compare their performance</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Strategy Card Component
function StrategyCard({ performance }) {
  return (
    <div className="strategy-card">
      <div className="card-header">
        <h3>{formatStrategyName(performance.strategy)}</h3>
        <span className="trade-count">{performance.total_trades} trades</span>
      </div>

      <div className="metric-grid">
        {/* Total P&L */}
        <div className="metric-item">
          <span className="metric-label">Total P&L</span>
          <span
            className={`metric-value ${
              performance.total_pnl >= 0 ? "positive" : "negative"
            }`}
          >
            ₹{Math.abs(performance.total_pnl).toFixed(2)}
          </span>
        </div>

        {/* Win Rate */}
        <div className="metric-item">
          <span className="metric-label">Win Rate</span>
          <span className="metric-value">
            {performance.win_rate.toFixed(1)}%
          </span>
        </div>

        {/* Average Win */}
        <div className="metric-item">
          <span className="metric-label">Avg Win</span>
          <span className="metric-value positive">
            ₹{Math.abs(performance.average_win).toFixed(2)}
          </span>
        </div>

        {/* Average Loss */}
        <div className="metric-item">
          <span className="metric-label">Avg Loss</span>
          <span className="metric-value negative">
            ₹{Math.abs(performance.average_loss).toFixed(2)}
          </span>
        </div>

        {/* Max Win */}
        <div className="metric-item">
          <span className="metric-label">Max Win</span>
          <span className="metric-value positive">
            ₹{Math.abs(performance.max_win).toFixed(2)}
          </span>
        </div>

        {/* Max Loss */}
        <div className="metric-item">
          <span className="metric-label">Max Loss</span>
          <span className="metric-value negative">
            ₹{Math.abs(performance.max_loss).toFixed(2)}
          </span>
        </div>

        {/* Sharpe Ratio */}
        <div className="metric-item">
          <span className="metric-label">Sharpe Ratio</span>
          <span className="metric-value">
            {performance.sharpe_ratio.toFixed(3)}
          </span>
        </div>

        {/* Profit Factor */}
        <div className="metric-item">
          <span className="metric-label">Profit Factor</span>
          <span className="metric-value">
            {(
              Math.abs(performance.average_win) /
              Math.abs(performance.average_loss)
            ).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Utility Functions
function formatStrategyName(strategy) {
  return strategy
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatMetricName(metric) {
  const names = {
    total_trades: "Total Trades",
    total_pnl: "Total P&L (₹)",
    win_rate: "Win Rate (%)",
    average_win: "Avg Win (₹)",
    average_loss: "Avg Loss (₹)",
    max_win: "Max Win (₹)",
    max_loss: "Max Loss (₹)",
    sharpe_ratio: "Sharpe Ratio",
  };
  return names[metric] || metric;
}

function formatMetricValue(value, metric) {
  if (metric === "win_rate") {
    return `${value.toFixed(1)}%`;
  }
  if (metric === "total_trades") {
    return Math.round(value);
  }
  if (
    metric.includes("pnl") ||
    metric.includes("win") ||
    metric.includes("loss")
  ) {
    return `₹${Math.abs(value).toFixed(2)}`;
  }
  if (metric === "sharpe_ratio") {
    return value.toFixed(3);
  }
  return value.toFixed(2);
}

function getMetricColor(metric, value) {
  if (
    metric === "total_pnl" ||
    metric === "average_win" ||
    metric === "max_win"
  ) {
    return value >= 0 ? "positive" : "negative";
  }
  if (metric === "average_loss" || metric === "max_loss") {
    return value <= 0 ? "positive" : "negative";
  }
  return "";
}

export default StrategyPage;
