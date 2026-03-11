// Trades Page with all details in single row with collapsible details
import React, { useState, useEffect, useRef } from "react";
import { tradesAPI } from "../services/api";
import "../styles/trades.css";

function TradesPage() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const datePickerRef = useRef(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await tradesAPI.getAllTrades(500);
        setTrades(response.data || []);
      } catch (error) {
        console.error("Failed to load trades:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, []);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowCustomDatePicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get date range based on filter
  const getDateRange = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const formatDate = (date) => date.toISOString().split("T")[0];

    switch (dateFilter) {
      case "1day":
        return { start: formatDate(today), end: formatDate(today) };
      case "2day":
        return { start: formatDate(yesterday), end: formatDate(today) };
      case "custom":
        return { start: customStartDate, end: customEndDate };
      case "all":
      default:
        return { start: null, end: null };
    }
  };

  // Filter and sort trades
  const processedTrades = trades
    .filter((trade) => {
      const matchSearch =
        !searchTerm ||
        trade.strategy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trade.date.includes(searchTerm) ||
        trade.entry_reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trade.sold_option && trade.sold_option.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStrategy =
        filterStrategy === "all" || trade.strategy === filterStrategy;

      // Date filter
      const dateRange = getDateRange();
      let matchDate = true;
      if (dateRange.start && dateRange.end) {
        matchDate = trade.date >= dateRange.start && trade.date <= dateRange.end;
      }

      return matchSearch && matchStrategy && matchDate;
    })
    .sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  const strategies = [...new Set(trades.map((t) => t.strategy))];

  const totalPnL = processedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
  const winningTrades = processedTrades.filter((t) => t.pnl > 0).length;
  const losingTrades = processedTrades.filter((t) => t.pnl < 0).length;
  const breakEvenTrades = processedTrades.filter((t) => t.pnl === 0).length;
  const winRate =
    processedTrades.length > 0
      ? ((winningTrades / processedTrades.length) * 100).toFixed(2)
      : 0;

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const applyCustomDateFilter = () => {
    if (customStartDate && customEndDate) {
      setDateFilter("custom");
      setShowCustomDatePicker(false);
    }
  };

  const clearCustomDateFilter = () => {
    setCustomStartDate("");
    setCustomEndDate("");
    setDateFilter("all");
    setShowCustomDatePicker(false);
  };

  if (loading) {
    return (
      <div className="trades-page">
        <div className="spinner">Loading trades...</div>
      </div>
    );
  }

  return (
    <div className="trades-page">
      <div className="trades-header">
        <div className="header-top">
          <h1>📊 Trade History</h1>
          <div className="header-stats">
            <div className="stat-card">
              <span className="stat-label">Total Trades</span>
              <span className="stat-value">{processedTrades.length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total P&L</span>
              <span
                className={`stat-value ${totalPnL >= 0 ? "positive" : "negative"}`}
              >
                ₹{totalPnL.toFixed(2)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Win Rate</span>
              <span className="stat-value">{winRate}%</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Results</span>
              <span className="stat-value">
                <span className="result-win">✅ {winningTrades}</span>
                <span className="result-loss">❌ {losingTrades}</span>
                <span className="result-neutral">➡️ {breakEvenTrades}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="filters-section">
          <div className="quick-date-filters">
            <button
              className={`date-btn ${dateFilter === "all" ? "active" : ""}`}
              onClick={() => setDateFilter("all")}
            >
              All Trades
            </button>
            <button
              className={`date-btn ${dateFilter === "1day" ? "active" : ""}`}
              onClick={() => setDateFilter("1day")}
            >
              Last 1 Day
            </button>
            <button
              className={`date-btn ${dateFilter === "2day" ? "active" : ""}`}
              onClick={() => setDateFilter("2day")}
            >
              Last 2 Days
            </button>
            <div className="custom-date-wrapper" ref={datePickerRef}>
              <button
                className={`date-btn ${dateFilter === "custom" ? "active" : ""}`}
                onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
              >
                📅 Custom
              </button>
              {showCustomDatePicker && (
                <div className="date-picker-popup">
                  <div className="date-picker-header">
                    <h4>Select Date Range</h4>
                    <button
                      className="close-btn"
                      onClick={() => setShowCustomDatePicker(false)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="date-picker-body">
                    <div className="date-input-group">
                      <label>From</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="date-input"
                      />
                    </div>
                    <div className="date-input-group">
                      <label>To</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="date-input"
                      />
                    </div>
                  </div>
                  <div className="date-picker-footer">
                    <button
                      className="btn-clear"
                      onClick={clearCustomDateFilter}
                    >
                      Clear
                    </button>
                    <button
                      className="btn-apply"
                      onClick={applyCustomDateFilter}
                      disabled={!customStartDate || !customEndDate}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="search-and-filter">
            <div className="search-box">
              <input
                type="text"
                placeholder="🔍 Search by date, strategy, reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <select
              value={filterStrategy}
              onChange={(e) => setFilterStrategy(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Strategies</option>
              {strategies.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategy}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {processedTrades.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No trades match your filters</p>
        </div>
      ) : (
        <div className="trades-table-wrapper">
          <table className="trades-table">
            <thead>
              <tr>
                <th className="th-expand"></th>
                <th onClick={() => handleSort("date")} className="sortable">
                  <span className="th-content">
                    Date
                    {sortBy === "date" && <span className="sort-icon">{sortOrder === "asc" ? "▲" : "▼"}</span>}
                  </span>
                </th>
                <th onClick={() => handleSort("nifty_value")} className="sortable">
                  <span className="th-content">
                    NIFTY
                    {sortBy === "nifty_value" && <span className="sort-icon">{sortOrder === "asc" ? "▲" : "▼"}</span>}
                  </span>
                </th>
                <th onClick={() => handleSort("strategy")} className="sortable">
                  <span className="th-content">
                    Strategy
                    {sortBy === "strategy" && <span className="sort-icon">{sortOrder === "asc" ? "▲" : "▼"}</span>}
                  </span>
                </th>
                <th>Entry Reason</th>
                <th>Sold Option</th>
                <th>Position</th>
                <th>Entry → Exit Time</th>
                <th onClick={() => handleSort("entry_premium")} className="sortable">
                  <span className="th-content">
                    Entry / Exit Premium
                    {sortBy === "entry_premium" && <span className="sort-icon">{sortOrder === "asc" ? "▲" : "▼"}</span>}
                  </span>
                </th>
                <th>Exit Reason</th>
                <th>Qty</th>
                <th onClick={() => handleSort("pnl")} className="sortable">
                  <span className="th-content">
                    P&L
                    {sortBy === "pnl" && <span className="sort-icon">{sortOrder === "asc" ? "▲" : "▼"}</span>}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {processedTrades.map((trade, idx) => (
                <React.Fragment key={idx}>
                  <tr
                    className={`trade-row ${
                      trade.pnl > 0 ? "profitable" : trade.pnl < 0 ? "loss" : "neutral"
                    }`}
                  >
                    <td className="cell-expand" onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}>
                      <span className={`chevron-icon ${expandedRow === idx ? "open" : ""}`}>▶</span>
                    </td>
                    <td className="cell-date">{trade.date}</td>
                    <td className="cell-nifty">{trade.nifty_value}</td>
                    <td className="cell-strategy">
                      <span className="strategy-badge-compact">{trade.strategy}</span>
                    </td>
                    <td className="cell-reason" title={trade.entry_reason}>
                      {trade.entry_reason}
                    </td>
                    <td className="cell-option" title={trade.sold_option || "N/A"}>
                      {trade.sold_option ? trade.sold_option : "—"}
                    </td>
                    <td className="cell-position">
                      <span className={`badge-position ${trade.position_type}`}>
                        {trade.position_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="cell-time-range">
                      <div className="time-range-compact">
                        <span className="entry-time-compact">{trade.entry_time}</span>
                        <span className="arrow-compact">→</span>
                        <span className="exit-time-compact">{trade.exit_time}</span>
                      </div>
                    </td>
                    <td className="cell-premium-range">
                      <div className="premium-range-compact">
                        <span className="prem-entry-compact">₹{Number(trade.entry_premium || 0).toFixed(1)}</span>
                        <span className="slash-compact">/</span>
                        <span className="prem-exit-compact">₹{Number(trade.exit_premium || 0).toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="cell-exit-reason" title={trade.exit_reason}>
                      {trade.exit_reason}
                    </td>
                    <td className="cell-qty">{trade.quantity}</td>
                    <td className="cell-pnl">
                      <span
                        className={`pnl-badge-compact ${
                          trade.pnl > 0
                            ? "pnl-positive"
                            : trade.pnl < 0
                            ? "pnl-negative"
                            : "pnl-neutral"
                        }`}
                      >
                        {trade.pnl > 0 ? "+" : ""}₹{Number(trade.pnl || 0).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                  {expandedRow === idx && (
                    <tr className="expanded-detail-row">
                      <td colSpan="11">
                        <div className="expanded-detail-content">
                          <div className="detail-grid">
                            {trade.option_strike && (
                              <div className="detail-item">
                                <span className="detail-label">Option Strike</span>
                                <span className="detail-value">{trade.option_strike}</span>
                              </div>
                            )}
                            {trade.ce_symbol && (
                              <div className="detail-item">
                                <span className="detail-label">CE Symbol</span>
                                <span className="detail-value">{trade.ce_symbol}</span>
                              </div>
                            )}
                            {trade.pe_symbol && (
                              <div className="detail-item">
                                <span className="detail-label">PE Symbol</span>
                                <span className="detail-value">{trade.pe_symbol}</span>
                              </div>
                            )}
                            {trade.position_type && (
                              <div className="detail-item">
                                <span className="detail-label">Position Type</span>
                                <span className="detail-value">{trade.position_type.replace(/_/g, ' ')}</span>
                              </div>
                            )}
                            {trade.straddle_vwap && (
                              <div className="detail-item">
                                <span className="detail-label">Straddle VWAP</span>
                                <span className="detail-value">₹{Number(trade.straddle_vwap).toFixed(2)}</span>
                              </div>
                            )}
                            {trade.pivot && (
                              <div className="detail-item">
                                <span className="detail-label">Pivot</span>
                                <span className="detail-value">{trade.pivot}</span>
                              </div>
                            )}
                            {trade.s1 && (
                              <div className="detail-item">
                                <span className="detail-label">S1</span>
                                <span className="detail-value">{trade.s1}</span>
                              </div>
                            )}
                            {trade.s2 && (
                              <div className="detail-item">
                                <span className="detail-label">S2</span>
                                <span className="detail-value">{trade.s2}</span>
                              </div>
                            )}
                            {trade.r1 && (
                              <div className="detail-item">
                                <span className="detail-label">R1</span>
                                <span className="detail-value">{trade.r1}</span>
                              </div>
                            )}
                            {trade.r2 && (
                              <div className="detail-item">
                                <span className="detail-label">R2</span>
                                <span className="detail-value">{trade.r2}</span>
                              </div>
                            )}
                            <div className="detail-item">
                              <span className="detail-label">Entry Reason</span>
                              <span className="detail-value">{trade.entry_reason}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Exit Reason</span>
                              <span className="detail-value">{trade.exit_reason}</span>
                            </div>
                            {trade.sold_option && (
                              <div className="detail-item">
                                <span className="detail-label">Sold Option</span>
                                <span className="detail-value">{trade.sold_option}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TradesPage;
