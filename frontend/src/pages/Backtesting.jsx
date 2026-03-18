// Backtesting Analytics Page — Client-side backtest analysis + persistent history
import React, { useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  Area, AreaChart, ReferenceLine,
} from "recharts";
import {
  parseCSV, runFullAnalysis,
} from "../services/backtestAnalytics";
import { backtestAPI } from "../services/api";
import "../styles/backtesting.css";

// Color constants
const TEAL = "#00897b";
const GREEN = "#00c853";
const RED = "#ef5350";
const BLUE = "#1976d2";
const ORANGE = "#f57c00";
const PURPLE = "#7b1fa2";
const STRATEGY_COLORS = [TEAL, BLUE, ORANGE, PURPLE, "#fbc02d", "#00bcd4", "#e91e63", "#8bc34a"];

function BacktestingPage() {
  const [trades, setTrades] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // Trade log state
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("asc");
  const [filterStrategy, setFilterStrategy] = useState("all");
  const [filterResult, setFilterResult] = useState("all");

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({ session_name: "", description: "", notes: "", strategy_name: "", tags: "" });
  const [saving, setSaving] = useState(false);

  // History state
  const [sessions, setSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedCompare, setSelectedCompare] = useState([]);
  const [compareData, setCompareData] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);
  const [editNotesText, setEditNotesText] = useState("");

  // ─── CSV Upload Handler ──────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        const parsed = parseCSV(csvText);
        if (parsed.length === 0) {
          toast.error("No valid trades found in CSV");
          return;
        }
        const results = runFullAnalysis(parsed);
        if (!results) {
          toast.error("Failed to analyze trades");
          return;
        }
        setTrades(parsed);
        setAnalysis(results);
        setActiveTab("overview");
        toast.success(`✅ Loaded ${parsed.length} trades from ${file.name}`);
      } catch (err) {
        toast.error(`CSV Error: ${err.message}`);
        console.error(err);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleClear = () => {
    setTrades([]);
    setAnalysis(null);
    setActiveTab("overview");
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Data cleared");
  };

  // ─── Trade Log Sorting ───────────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getSortedTrades = () => {
    let filtered = [...trades];
    if (filterStrategy !== "all") {
      filtered = filtered.filter(t => t.strategy === filterStrategy);
    }
    if (filterResult === "win") filtered = filtered.filter(t => t.pnl > 0);
    else if (filterResult === "loss") filtered = filtered.filter(t => t.pnl < 0);

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      aVal = String(aVal || '');
      bVal = String(bVal || '');
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return filtered;
  };

  const sortArrow = (field) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  // ─── History Handlers ────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await backtestAPI.listSessions();
      console.log("rwse===>", res)
      setSessions(res.data);
    } catch (err) {
      console.error("Failed to load history:", err);
      toast.error("Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleSave = async () => {
    if (!saveForm.session_name.trim()) {
      toast.error("Session name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        session_name: saveForm.session_name.trim(),
        description: saveForm.description.trim(),
        notes: saveForm.notes.trim(),
        strategy_name: saveForm.strategy_name.trim(),
        tags: saveForm.tags.split(",").map(t => t.trim()).filter(Boolean),
        data_date_from: analysis.dateRange.from,
        data_date_to: analysis.dateRange.to,
        total_trades: analysis.tradeCount,
        net_pnl: analysis.kpis.totalPnL,
        win_rate: analysis.kpis.winRate,
        profit_factor: analysis.kpis.profitFactor === Infinity ? 999999 : analysis.kpis.profitFactor,
        max_drawdown: analysis.drawdown.maxDrawdown,
        sharpe_ratio: analysis.sharpeRatio,
        expectancy: analysis.kpis.expectancy,
        risk_reward: analysis.kpis.riskRewardRatio === Infinity ? 999999 : analysis.kpis.riskRewardRatio,
        max_win_streak: analysis.streaks.maxWinStreak,
        max_loss_streak: analysis.streaks.maxLossStreak,
        trades: trades.map(t => ({
          date: t.date,
          position: t.position_type,
          nifty_at_entry: t.nifty_value,
          entry_reason: t.entry_reason,
          entry_time: t.entry_time,
          entry_price: t.entry_premium,
          exit_time: t.exit_time,
          exit_price: t.exit_premium,
          exit_reason: t.exit_reason,
          pnl_pts: t.pnl_pts || 0,
          pnl_inr: t.pnl,
          trade_duration: t.trade_duration || "",
          pivot: t.pivot,
          r1: t.r1,
          r2: t.r2,
          s1: t.s1,
          s2: t.s2,
        })),
      };
      await backtestAPI.saveSessions(payload);
      toast.success(`💾 Saved "${saveForm.session_name}"`);
      setShowSaveModal(false);
      setSaveForm({ session_name: "", description: "", notes: "", strategy_name: "", tags: "" });
      loadHistory(); // Reload to show the new saved item in history
    } catch (err) {
      toast.error(`Save failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await backtestAPI.deleteSession(id);
      toast.success(`Deleted "${name}"`);
      loadHistory();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const toggleCompareSelect = (id) => {
    setSelectedCompare(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 3 ? prev : [...prev, id]
    );
  };

  const handleCompare = async () => {
    if (selectedCompare.length < 2) { toast.error("Select at least 2 sessions"); return; }
    try {
      const res = await backtestAPI.compareSessions(selectedCompare);
      setCompareData(res.data.sessions);
    } catch (err) {
      toast.error("Compare failed");
    }
  };

  const handleSaveNotes = async (sessionId) => {
    try {
      await backtestAPI.updateNotes(sessionId, { notes: editNotesText });
      toast.success("Notes saved");
      setEditingNotes(null);
      loadHistory();
    } catch (err) {
      toast.error("Failed to save notes");
    }
  };

  const handleLoadSession = async (id, name) => {
    const toastId = toast.loading(`Loading session "${name}"...`);
    try {
      const res = await backtestAPI.getSession(id);
      if (res.data && res.data.trades) {
        // We must map the DB fields back to the format the frontend parser expects
        const mappedTrades = res.data.trades.map(t => ({
          date: t.date,
          position_type: t.position,
          strategy: t.position,
          nifty_value: t.nifty_at_entry,
          entry_reason: t.entry_reason,
          entry_time: t.entry_time,
          entry_premium: t.entry_price,
          exit_time: t.exit_time,
          exit_premium: t.exit_price,
          exit_reason: t.exit_reason,
          pnl_pts: t.pnl_pts,
          pnl: t.pnl_inr,
          trade_duration: t.trade_duration,
          pivot: t.pivot,
          r1: t.r1,
          r2: t.r2,
          s1: t.s1,
          s2: t.s2,
        }));

        const results = runFullAnalysis(mappedTrades);
        setTrades(mappedTrades);
        setAnalysis(results);
        setActiveTab("overview");
        toast.success(`Loaded "${name}"`, { id: toastId });
      } else {
        toast.error("Session data is empty", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load session data", { id: toastId });
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────
  const {
    drawdown, streaks, exitReasonAnalysis, entryReasonAnalysis,
    equityCurve, pnlDistribution, monthlyBreakdown, hourlyAnalysis,
    dayOfWeekAnalysis, durationAnalysis, strategyComparison, strategies
  } = analysis || {};

  return (
    <div className="backtesting-page">
      <h1>🧪 Backtesting Analytics</h1>

      {/* TABS (Always visible) */}
      <div className="bt-tabs" style={{ marginBottom: "1rem" }}>
        {['overview', 'charts', 'time', 'strategy', 'tradelog'].map(tab => {
          // Hide these tabs if no analysis is loaded
          if (!analysis) return null;

          let label = tab.charAt(0).toUpperCase() + tab.slice(1);
          if (tab === 'overview') label = '📈 Overview';
          if (tab === 'charts') label = '📊 Charts';
          if (tab === 'time') label = '⏰ Time Analysis';
          if (tab === 'strategy') label = '🎯 Strategies';
          if (tab === 'tradelog') label = `📋 Trade Log (${analysis.tradeCount})`;

          return (
            <button
              key={tab}
              className={`bt-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          );
        })}
        {/* History tab is always visible */}
        <button
          className={`bt-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          📚 History
        </button>
        {/* Upload new tab is always visible if something is loaded */}
        {analysis && (
          <button
            className={`bt-tab ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            ➕ New Analytics
          </button>
        )}
      </div>

      {/* UPLOAD / NO DATA STATE (Shows if no analysis AND not on history tab, OR if on 'upload' tab) */}
      {((!analysis && activeTab !== "history") || activeTab === "upload") && (
        <>
          <p className="subtitle">
            Upload your backtest CSV to get professional-grade strategy analysis
          </p>
          <div
            className={`bt-upload-zone ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <span className="upload-icon">📊</span>
            <h3>Drop your backtesting CSV here</h3>
            <p>or click to browse files • Backtesting CSV format</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {!analysis && (
            <p className="kpi-sub" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              Or go to <button style={{ background: 'none', border: 'none', color: 'var(--accent-teal)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 'inherit' }} onClick={() => setActiveTab('history')}>📚 History</button> to view saved sessions
            </p>
          )}


          <div className="bt-empty">
            <span className="empty-icon">🔬</span>
            <h3>No backtest data loaded</h3>
            <p>Upload a CSV with columns: date, position, nifty_at_entry, entry_reason,<br />
              entry_time, entry_price, exit_time, exit_price, exit_reason,<br />
              pnl_pts, pnl_inr, trade_duration, pivot, r1, r2, s1, s2</p>
          </div>
        </>
      )}

      {/* ANALYSIS SUB-TABS (Shows only when analysis is loaded AND not on history/upload) */}
      {analysis && activeTab !== "history" && activeTab !== "upload" && (
        <>
          {/* Upload Summary Bar */}
          <div className="bt-upload-summary">
            <div className="file-info">
              <span className="file-badge">📊 {analysis.tradeCount} trades</span>
              <span className="file-stat">
                <strong>{analysis.dateRange.from}</strong> → <strong>{analysis.dateRange.to}</strong>
              </span>
              <span className="file-stat">
                {analysis.strategies.length} position{analysis.strategies.length === 1 ? "" : "s"}
              </span>
              <span className="file-stat" style={{ color: analysis.kpis.totalPnL >= 0 ? GREEN : RED }}>
                Net: ₹{analysis.kpis.totalPnL.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="bt-save-btn" onClick={() => setShowSaveModal(true)}>💾 Save</button>
              <button className="bt-clear-btn" onClick={handleClear}>✕ Clear</button>
            </div>
          </div>

          {/* ─── OVERVIEW TAB ─────────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div>
              {/* Primary KPIs */}
              <div className="bt-kpi-grid">
                <KPICard
                  icon="💰" label="Net P&L" cls={analysis.kpis.totalPnL >= 0 ? "card-green" : "card-red"}
                  value={`₹${analysis.kpis.totalPnL.toFixed(2)}`}
                  valueClass={analysis.kpis.totalPnL >= 0 ? "val-positive" : "val-negative"}
                  sub={`${analysis.kpis.winningTrades}W / ${analysis.kpis.losingTrades}L / ${analysis.kpis.breakEvenTrades}BE`}
                />
                <KPICard
                  icon="🎯" label="Win Rate" cls="card-teal"
                  value={`${analysis.kpis.winRate}%`}
                  valueClass={analysis.kpis.winRate >= 50 ? "val-positive" : "val-negative"}
                  sub={`${analysis.kpis.winningTrades} of ${analysis.kpis.totalTrades} trades`}
                />
                <KPICard
                  icon="📊" label="Profit Factor" cls="card-blue"
                  value={analysis.kpis.profitFactor === Infinity ? "∞" : analysis.kpis.profitFactor.toFixed(2)}
                  valueClass={analysis.kpis.profitFactor >= 1.5 ? "val-positive" : analysis.kpis.profitFactor >= 1 ? "val-neutral" : "val-negative"}
                  sub={analysis.kpis.profitFactor >= 2 ? "✨ Excellent" : analysis.kpis.profitFactor >= 1.5 ? "👍 Good" : analysis.kpis.profitFactor >= 1 ? "⚠️ Marginal" : "❌ Unprofitable"}
                />
                <KPICard
                  icon="🧮" label="Expectancy" cls="card-purple"
                  value={`₹${analysis.kpis.expectancy.toFixed(2)}`}
                  valueClass={analysis.kpis.expectancy > 0 ? "val-positive" : "val-negative"}
                  sub="Expected ₹ per trade"
                />
              </div>

              {/* Risk Metrics */}
              <h3 className="bt-section-header">⚡ Risk Metrics</h3>
              <div className="bt-risk-grid">
                <RiskItem label="Max Drawdown" value={`₹${analysis.drawdown.maxDrawdown.toFixed(2)}`}
                  badge={analysis.drawdown.maxDrawdown < Math.abs(analysis.kpis.totalPnL) * 0.5 ? "Manageable" : "Caution"}
                  badgeClass={analysis.drawdown.maxDrawdown < Math.abs(analysis.kpis.totalPnL) * 0.5 ? "badge-good" : "badge-warning"}
                />
                <RiskItem label="Sharpe Ratio" value={analysis.sharpeRatio.toFixed(2)}
                  badge={analysis.sharpeRatio > 2 ? "Excellent" : analysis.sharpeRatio > 1 ? "Good" : analysis.sharpeRatio > 0 ? "Low" : "Negative"}
                  badgeClass={analysis.sharpeRatio > 2 ? "badge-excellent" : analysis.sharpeRatio > 1 ? "badge-good" : analysis.sharpeRatio > 0 ? "badge-warning" : "badge-danger"}
                />
                <RiskItem label="Risk-Reward" value={analysis.kpis.riskRewardRatio === Infinity ? "∞" : `${analysis.kpis.riskRewardRatio.toFixed(2)}x`}
                  badge={analysis.kpis.riskRewardRatio >= 2 ? "Excellent" : analysis.kpis.riskRewardRatio >= 1 ? "Good" : "Risky"}
                  badgeClass={analysis.kpis.riskRewardRatio >= 2 ? "badge-excellent" : analysis.kpis.riskRewardRatio >= 1 ? "badge-good" : "badge-danger"}
                />
                <RiskItem label="Avg Win" value={`₹${analysis.kpis.avgWin.toFixed(2)}`} />
                <RiskItem label="Avg Loss" value={`₹${analysis.kpis.avgLoss.toFixed(2)}`} />
                <RiskItem label="Largest Win" value={`₹${analysis.kpis.largestWin.toFixed(2)}`} />
                <RiskItem label="Largest Loss" value={`₹${Math.abs(analysis.kpis.largestLoss).toFixed(2)}`} />
                <RiskItem label="Total Trades" value={analysis.kpis.totalTrades} />
              </div>

              {/* Streaks */}
              <h3 className="bt-section-header">🔥 Streak Analysis</h3>
              <div className="bt-streaks">
                <StreakItem label="Max Win Streak" value={streaks.maxWinStreak} emoji="🟢" />
                <StreakItem label="Max Loss Streak" value={streaks.maxLossStreak} emoji="🔴" />
                <StreakItem
                  label="Current Streak"
                  value={`${streaks.currentStreak} ${streaks.currentStreakType === 'win' ? '🟢' : streaks.currentStreakType === 'loss' ? '🔴' : '⚪'}`}
                  emoji={streaks.currentStreakType === 'win' ? '📈' : streaks.currentStreakType === 'loss' ? '📉' : '➡️'}
                />
              </div>

              {/* Entry Reason Analysis */}
              {entryReasonAnalysis && entryReasonAnalysis.length > 0 && (
                <>
                  <h3 className="bt-section-header">🚀 Entry Reason Breakdown</h3>
                  <div className="bt-chart-container">
                    <div style={{ overflowX: "auto" }}>
                      <table className="bt-strategy-table">
                        <thead>
                          <tr>
                            <th>Entry Reason</th>
                            <th>Trades</th>
                            <th>P&L</th>
                            <th>Win Rate</th>
                            <th>Avg P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entryReasonAnalysis.map((r, idx) => (
                            <tr key={idx}>
                              <td>{r.reason}</td>
                              <td>{r.trades}</td>
                              <td style={{ color: r.pnl >= 0 ? GREEN : RED, fontWeight: 600 }}>
                                ₹{r.pnl.toFixed(2)}
                              </td>
                              <td>{r.winRate}%</td>
                              <td style={{ color: r.avgPnl >= 0 ? GREEN : RED }}>
                                ₹{r.avgPnl.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Exit Reason Analysis */}
              {exitReasonAnalysis.length > 0 && (
                <>
                  <h3 className="bt-section-header">🚪 Exit Reason Breakdown</h3>
                  <div className="bt-chart-container">
                    <div style={{ overflowX: "auto" }}>
                      <table className="bt-strategy-table">
                        <thead>
                          <tr>
                            <th>Exit Reason</th>
                            <th>Trades</th>
                            <th>P&L</th>
                            <th>Win Rate</th>
                            <th>Avg P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exitReasonAnalysis.map((r, idx) => (
                            <tr key={idx}>
                              <td>{r.reason}</td>
                              <td>{r.trades}</td>
                              <td style={{ color: r.pnl >= 0 ? GREEN : RED, fontWeight: 600 }}>
                                ₹{r.pnl.toFixed(2)}
                              </td>
                              <td>{r.winRate}%</td>
                              <td style={{ color: r.avgPnl >= 0 ? GREEN : RED }}>
                                ₹{r.avgPnl.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── CHARTS TAB ───────────────────────────────────────────────────── */}
          {activeTab === "charts" && (
            <div className="bt-charts-grid">
              {/* Equity Curve */}
              <div className="bt-chart-container">
                <h3>📈 Equity Curve (Cumulative P&L)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={equityCurve.dates.map((d, i) => ({
                    date: d.slice(5), cumPnl: equityCurve.cumulative[i],
                  }))}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={TEAL} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a1a", border: `1px solid ${TEAL}`, fontSize: 12 }}
                      formatter={(v) => [`₹${v.toFixed(2)}`, "Cumulative P&L"]}
                    />
                    <ReferenceLine y={0} stroke="#555" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="cumPnl" stroke={TEAL} strokeWidth={2}
                      fill="url(#eqGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Drawdown Chart */}
              <div className="bt-chart-container">
                <h3>📉 Drawdown (Underwater Curve)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={drawdown.drawdownSeries}>
                    <defs>
                      <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={RED} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={RED} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }}
                      tickFormatter={(v) => v?.slice(5) || v} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a1a", border: `1px solid ${RED}`, fontSize: 12 }}
                      formatter={(v) => [`₹${v.toFixed(2)}`, "Drawdown"]}
                    />
                    <ReferenceLine y={0} stroke="#555" />
                    <Area type="monotone" dataKey="drawdown" stroke={RED} strokeWidth={2}
                      fill="url(#ddGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bt-charts-grid-2">
                {/* Daily P&L */}
                <div className="bt-chart-container">
                  <h3>📊 Daily P&L</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={equityCurve.dates.map((d, i) => ({
                      date: d.slice(5), pnl: equityCurve.daily[i],
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1a1a1a", border: `1px solid ${BLUE}`, fontSize: 12 }}
                        formatter={(v) => [`₹${v.toFixed(2)}`, "P&L"]}
                      />
                      <ReferenceLine y={0} stroke="#555" />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {equityCurve.daily.map((pnl, idx) => (
                          <Cell key={idx} fill={pnl >= 0 ? GREEN : RED} opacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* P&L Distribution */}
                <div className="bt-chart-container">
                  <h3>📐 P&L Distribution</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={pnlDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1a1a1a", border: `1px solid ${PURPLE}`, fontSize: 12 }}
                        formatter={(v, name, props) => [v, "Trades"]}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.rangeLabel || label}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {pnlDistribution.map((bucket, idx) => (
                          <Cell key={idx} fill={bucket.low >= 0 ? GREEN : bucket.high <= 0 ? RED : ORANGE} opacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Breakdown */}
              {monthlyBreakdown.length > 1 && (
                <div className="bt-chart-container">
                  <h3>📅 Monthly P&L</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1a1a1a", border: `1px solid ${BLUE}`, fontSize: 12 }}
                        formatter={(v) => [`₹${v.toFixed(2)}`, "P&L"]}
                      />
                      <ReferenceLine y={0} stroke="#555" />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {monthlyBreakdown.map((m, idx) => (
                          <Cell key={idx} fill={m.pnl >= 0 ? GREEN : RED} opacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ─── TIME ANALYSIS TAB ────────────────────────────────────────────── */}
          {activeTab === "time" && (
            <div className="bt-time-grid">
              {/* Hourly P&L */}
              <div className="bt-chart-container">
                <h3>⏰ P&L by Entry Hour</h3>
                {hourlyAnalysis.filter(h => h.trades > 0).length > 0 ? (
                  <>
                    {hourlyAnalysis.map((h, idx) => {
                      if (h.trades === 0) return null;
                      const maxPnl = Math.max(...hourlyAnalysis.map(x => Math.abs(x.pnl)), 1);
                      const barWidth = Math.max(Math.abs(h.pnl) / maxPnl * 100, 8);
                      return (
                        <div className="bt-heatmap-row" key={idx}>
                          <span className="bt-heatmap-label">{h.hour}</span>
                          <div
                            className="bt-heatmap-bar"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: h.pnl >= 0 ? GREEN : RED,
                              opacity: 0.8,
                            }}
                          >
                            ₹{h.pnl.toFixed(0)}
                          </div>
                          <span className="bt-heatmap-stats">
                            {h.trades} trades • {h.winRate}% WR
                          </span>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>No hourly data available</p>
                )}
              </div>

              {/* Day of Week */}
              <div className="bt-chart-container">
                <h3>📅 P&L by Day of Week</h3>
                {dayOfWeekAnalysis.filter(d => d.trades > 0).length > 0 ? (
                  <>
                    {dayOfWeekAnalysis.map((d, idx) => {
                      if (d.trades === 0) return null;
                      const maxPnl = Math.max(...dayOfWeekAnalysis.map(x => Math.abs(x.pnl)), 1);
                      const barWidth = Math.max(Math.abs(d.pnl) / maxPnl * 100, 8);
                      return (
                        <div className="bt-heatmap-row" key={idx}>
                          <span className="bt-heatmap-label">{d.day.slice(0, 3)}</span>
                          <div
                            className="bt-heatmap-bar"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: d.pnl >= 0 ? GREEN : RED,
                              opacity: 0.8,
                            }}
                          >
                            ₹{d.pnl.toFixed(0)}
                          </div>
                          <span className="bt-heatmap-stats">
                            {d.trades} trades • {d.winRate}% WR
                          </span>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>No day-of-week data available</p>
                )}
              </div>

              {/* Trade Duration Scatter */}
              <div className="bt-chart-container" style={{ gridColumn: "1 / -1" }}>
                <h3>⏱️ Trade Duration vs P&L</h3>
                {durationAnalysis.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="duration" name="Duration (min)" type="number"
                        tick={{ fontSize: 11 }} label={{ value: "Duration (min)", position: "insideBottom", offset: -5, fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="pnl" name="P&L" type="number"
                        tick={{ fontSize: 11 }} label={{ value: "P&L (₹)", angle: -90, position: "insideLeft", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1a1a1a", border: `1px solid ${ORANGE}`, fontSize: 12 }}
                        formatter={(v, name) => [`${name === "P&L" ? "₹" : ""}${typeof v === "number" ? v.toFixed(2) : v}`, name]}
                        labelFormatter={() => ""}
                      />
                      <ReferenceLine y={0} stroke="#555" strokeDasharray="3 3" />
                      <Scatter name="Trades" data={durationAnalysis}>
                        {durationAnalysis.map((entry, idx) => (
                          <Cell key={idx} fill={entry.pnl >= 0 ? GREEN : RED} opacity={0.7} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>No duration data available</p>
                )}
              </div>

              {/* Entry/Exit time distribution bar chart */}
              <div className="bt-chart-container" style={{ gridColumn: "1 / -1" }}>
                <h3>📊 Trades per Hour (Entry Distribution)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={hourlyAnalysis.filter(h => h.trades > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a1a", border: `1px solid ${TEAL}`, fontSize: 12 }}
                    />
                    <Bar dataKey="trades" fill={TEAL} radius={[4, 4, 0, 0]} name="Trades" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ─── STRATEGY TAB ─────────────────────────────────────────────────── */}
          {activeTab === "strategy" && (
            <div>
              {/* Strategy Comparison Table */}
              <div className="bt-chart-container">
                <h3>🎯 Strategy Comparison</h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="bt-strategy-table">
                    <thead>
                      <tr>
                        <th>Strategy</th>
                        <th>Trades</th>
                        <th>Net P&L</th>
                        <th>Win Rate</th>
                        <th>Profit Factor</th>
                        <th>Expectancy</th>
                        <th>Avg Win</th>
                        <th>Avg Loss</th>
                        <th>Max DD</th>
                        <th>Sharpe</th>
                        <th>Max W. Streak</th>
                        <th>Max L. Streak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strategyComparison.map((s, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>
                            <span style={{
                              display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                              backgroundColor: STRATEGY_COLORS[idx % STRATEGY_COLORS.length],
                              marginRight: 6
                            }} />
                            {s.strategy}
                          </td>
                          <td>{s.totalTrades}</td>
                          <td style={{ color: s.totalPnL >= 0 ? GREEN : RED, fontWeight: 600 }}>
                            ₹{s.totalPnL.toFixed(2)}
                          </td>
                          <td style={{ color: s.winRate >= 50 ? GREEN : RED }}>
                            {s.winRate}%
                          </td>
                          <td>{s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)}</td>
                          <td style={{ color: s.expectancy >= 0 ? GREEN : RED }}>
                            ₹{s.expectancy.toFixed(2)}
                          </td>
                          <td>₹{s.avgWin.toFixed(2)}</td>
                          <td>₹{s.avgLoss.toFixed(2)}</td>
                          <td>₹{s.maxDrawdown.toFixed(2)}</td>
                          <td>{s.sharpeRatio.toFixed(2)}</td>
                          <td>{s.maxWinStreak}</td>
                          <td>{s.maxLossStreak}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Per-Strategy Equity Curves */}
              {strategies.length > 1 && (
                <div className="bt-chart-container">
                  <h3>📈 Strategy Equity Curves (Overlaid)</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="date"
                        type="category"
                        tick={{ fontSize: 10 }}
                        allowDuplicatedCategory={false}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1a1a1a", border: `1px solid ${TEAL}`, fontSize: 12 }}
                        formatter={(v) => `₹${v.toFixed(2)}`}
                      />
                      <ReferenceLine y={0} stroke="#555" strokeDasharray="3 3" />
                      {strategyComparison.map((s, idx) => {
                        const data = s.equityCurve.dates.map((d, i) => ({
                          date: d.slice(5),
                          [s.strategy]: s.equityCurve.cumulative[i],
                        }));
                        return (
                          <Line
                            key={s.strategy}
                            data={data}
                            dataKey={s.strategy}
                            name={s.strategy}
                            stroke={STRATEGY_COLORS[idx % STRATEGY_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Per-strategy P&L bar */}
              <div className="bt-chart-container">
                <h3>📊 P&L by Strategy</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={strategyComparison.map(s => ({
                    strategy: s.strategy.length > 18 ? s.strategy.slice(0, 16) + "…" : s.strategy,
                    pnl: s.totalPnL,
                    winRate: s.winRate,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="strategy" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a1a", border: `1px solid ${BLUE}`, fontSize: 12 }}
                      formatter={(v, name) => [name === "pnl" ? `₹${v.toFixed(2)}` : `${v}%`, name === "pnl" ? "P&L" : "Win Rate"]}
                    />
                    <ReferenceLine y={0} stroke="#555" />
                    <Bar dataKey="pnl" name="P&L" radius={[4, 4, 0, 0]}>
                      {strategyComparison.map((s, idx) => (
                        <Cell key={idx} fill={s.totalPnL >= 0 ? GREEN : RED} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ─── TRADE LOG TAB ────────────────────────────────────────────────── */}
          {activeTab === "tradelog" && (
            <div>
              {/* Filters */}
              <div className="bt-trade-filter">
                <select value={filterStrategy} onChange={e => setFilterStrategy(e.target.value)}>
                  <option value="all">All Positions</option>
                  {strategies.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterResult} onChange={e => setFilterResult(e.target.value)}>
                  <option value="all">All Results</option>
                  <option value="win">Winners ✅</option>
                  <option value="loss">Losers ❌</option>
                </select>
                <span className="bt-trade-count">
                  Showing {getSortedTrades().length} trades
                </span>
              </div>

              {/* Table */}
              <div className="bt-trade-log">
                <table className="bt-trade-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort("date")}>Date{sortArrow("date")}</th>
                      <th onClick={() => handleSort("position_type")}>Position{sortArrow("position_type")}</th>
                      <th onClick={() => handleSort("nifty_value")}>Nifty{sortArrow("nifty_value")}</th>
                      <th onClick={() => handleSort("entry_reason")}>Entry Reason{sortArrow("entry_reason")}</th>
                      <th onClick={() => handleSort("entry_time")}>Entry Time{sortArrow("entry_time")}</th>
                      <th onClick={() => handleSort("entry_premium")}>Entry ₹{sortArrow("entry_premium")}</th>
                      <th onClick={() => handleSort("exit_time")}>Exit Time{sortArrow("exit_time")}</th>
                      <th onClick={() => handleSort("exit_premium")}>Exit ₹{sortArrow("exit_premium")}</th>
                      <th onClick={() => handleSort("exit_reason")}>Exit Reason{sortArrow("exit_reason")}</th>
                      <th onClick={() => handleSort("pnl_pts")}>P&L Pts{sortArrow("pnl_pts")}</th>
                      <th onClick={() => handleSort("pnl")}>P&L ₹{sortArrow("pnl")}</th>
                      <th onClick={() => handleSort("trade_duration")}>Duration{sortArrow("trade_duration")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedTrades().map((t, idx) => (
                      <tr key={idx} className={t.pnl > 0 ? "row-profit" : t.pnl < 0 ? "row-loss" : ""}>
                        <td>{t.date}</td>
                        <td>{t.position_type}</td>
                        <td>{t.nifty_value.toFixed(1)}</td>
                        <td>{t.entry_reason}</td>
                        <td>{t.entry_time}</td>
                        <td>₹{t.entry_premium.toFixed(2)}</td>
                        <td>{t.exit_time}</td>
                        <td>₹{t.exit_premium.toFixed(2)}</td>
                        <td>{t.exit_reason}</td>
                        <td style={{ color: t.pnl_pts > 0 ? GREEN : t.pnl_pts < 0 ? RED : "inherit" }}>
                          {t.pnl_pts > 0 ? "+" : ""}{t.pnl_pts.toFixed(2)}
                        </td>
                        <td style={{ color: t.pnl > 0 ? GREEN : t.pnl < 0 ? RED : "inherit", fontWeight: 700 }}>
                          {t.pnl > 0 ? "+" : ""}₹{t.pnl.toFixed(2)}
                        </td>
                        <td>{t.trade_duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── HISTORY TAB ──────────────────────────────────────────────────── */}
      {activeTab === "history" && (
              <div>
                {loadingHistory ? (
                  <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>Loading history...</p>
                ) : sessions.length === 0 ? (
                  <div className="bt-empty">
                    <span className="empty-icon">📚</span>
                    <h3>No saved sessions yet</h3>
                    <p>Upload a backtesting CSV and click "💾 Save" to start building your strategy journal</p>
                  </div>
                ) : (
                  <>
                    {/* Compare controls */}
                    <div style={{ display: "flex", gap: "0.8rem", marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                        Select 2-3 sessions to compare:
                      </span>
                      {selectedCompare.length >= 2 && (
                        <button className="bt-save-btn" onClick={handleCompare}>
                          🔄 Compare ({selectedCompare.length})
                        </button>
                      )}
                      {selectedCompare.length > 0 && (
                        <button className="bt-clear-btn" style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                          onClick={() => { setSelectedCompare([]); setCompareData(null); }}>
                          Clear Selection
                        </button>
                      )}
                    </div>

                    {/* Compare Results */}
                    {compareData && compareData.length >= 2 && (
                      <div className="bt-chart-container" style={{ marginBottom: "1.5rem" }}>
                        <h3>🔄 Comparison Results</h3>
                        <div style={{ overflowX: "auto" }}>
                          <table className="bt-strategy-table">
                            <thead>
                              <tr>
                                <th>Session</th>
                                <th>Strategy</th>
                                <th>Trades</th>
                                <th>Net P&L</th>
                                <th>Win Rate</th>
                                <th>PF</th>
                                <th>Sharpe</th>
                                <th>Max DD</th>
                                <th>Expectancy</th>
                                <th>Date Range</th>
                              </tr>
                            </thead>
                            <tbody>
                              {compareData.map((s, idx) => (
                                <tr key={idx}>
                                  <td style={{ fontWeight: 600 }}>
                                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: STRATEGY_COLORS[idx % STRATEGY_COLORS.length], marginRight: 6 }} />
                                    {s.session_name}
                                  </td>
                                  <td>{s.strategy_name || "-"}</td>
                                  <td>{s.total_trades}</td>
                                  <td style={{ color: s.net_pnl >= 0 ? GREEN : RED, fontWeight: 600 }}>₹{parseFloat(s.net_pnl).toFixed(2)}</td>
                                  <td style={{ color: parseFloat(s.win_rate) >= 50 ? GREEN : RED }}>{parseFloat(s.win_rate).toFixed(1)}%</td>
                                  <td>{parseFloat(s.profit_factor).toFixed(2)}</td>
                                  <td>{parseFloat(s.sharpe_ratio).toFixed(2)}</td>
                                  <td>₹{parseFloat(s.max_drawdown).toFixed(2)}</td>
                                  <td style={{ color: parseFloat(s.expectancy) >= 0 ? GREEN : RED }}>₹{parseFloat(s.expectancy).toFixed(2)}</td>
                                  <td style={{ fontSize: "0.78rem" }}>{s.data_date_from} → {s.data_date_to}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Session Cards */}
                    {(() => {
                      try {
                        return sessions.map((s, idx) => (
                          <div key={s.id} className="bt-chart-container" style={{ marginBottom: "1rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedCompare.includes(s.id)}
                                    onChange={() => toggleCompareSelect(s.id)}
                                    style={{ accentColor: TEAL }}
                                  />
                                  <h3 style={{ margin: 0, fontSize: "1rem" }}>{s.session_name}</h3>
                                  {s.strategy_name && <span className="file-badge">{s.strategy_name}</span>}
                                </div>
                                {s.description && <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: "0.2rem 0" }}>{s.description}</p>}
                                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                                  <span>{s.data_date_from} → {s.data_date_to}</span>
                                  <span>•</span>
                                  <span>{s.total_trades} trades</span>
                                  <span>•</span>
                                  <span style={{ color: parseFloat(s.net_pnl) >= 0 ? GREEN : RED, fontWeight: 600 }}>₹{parseFloat(s.net_pnl).toFixed(2)}</span>
                                  <span>•</span>
                                  <span>WR: {parseFloat(s.win_rate).toFixed(1)}%</span>
                                  <span>•</span>
                                  <span>PF: {parseFloat(s.profit_factor).toFixed(2)}</span>
                                  <span>•</span>
                                  <span>Sharpe: {parseFloat(s.sharpe_ratio).toFixed(2)}</span>
                                </div>
                                {s.tags && s.tags.length > 0 && (
                                  <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                                    {s.tags.map((tag, ti) => (
                                      <span key={ti} style={{ background: "rgba(0,137,123,0.12)", color: TEAL, fontSize: "0.72rem", padding: "0.15rem 0.5rem", borderRadius: "10px", fontWeight: 600 }}>{tag}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                                <button
                                  className="bt-save-btn"
                                  style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                                  onClick={() => handleLoadSession(s.id, s.session_name)}
                                >
                                  ▶️ Load
                                </button>
                                <button
                                  className="bt-tab"
                                  style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                                  onClick={() => { setEditingNotes(editingNotes === s.id ? null : s.id); setEditNotesText(s.notes || ""); }}
                                >
                                  📝 Notes
                                </button>
                                <button
                                  className="bt-clear-btn"
                                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                                  onClick={() => handleDeleteSession(s.id, s.session_name)}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            {/* Notes Editor */}
                            {editingNotes === s.id && (
                              <div style={{ marginTop: "0.8rem", borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}>
                                <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>📝 Strategy Journal / Notes</label>
                                <textarea
                                  value={editNotesText}
                                  onChange={e => setEditNotesText(e.target.value)}
                                  placeholder="Write your observations... e.g., 'Works well in trending markets, fails in consolidation'"
                                  style={{
                                    width: "100%", minHeight: "80px", background: "var(--bg-tertiary, #1a1a2e)", border: "1px solid var(--border)",
                                    borderRadius: "8px", padding: "0.6rem", color: "var(--text-primary)", fontSize: "0.85rem", resize: "vertical",
                                  }}
                                />
                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                                  <button className="bt-save-btn" style={{ fontSize: "0.8rem", padding: "0.3rem 0.8rem" }} onClick={() => handleSaveNotes(s.id)}>Save Notes</button>
                                  <button className="bt-clear-btn" style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }} onClick={() => setEditingNotes(null)}>Cancel</button>
                                </div>
                              </div>
                            )}

                            {/* Show saved notes */}
                            {editingNotes !== s.id && s.notes && (
                              <div style={{ marginTop: "0.6rem", background: "rgba(0,137,123,0.05)", borderRadius: "6px", padding: "0.6rem", fontSize: "0.82rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                                📝 {s.notes}
                              </div>
                            )}
                          </div>
                        ));
                      } catch (e) {
                        return <div style={{ color: "red", padding: "1rem" }}>Render Error: {e.message}</div>;
                      }
                    })()}
                  </>
                )}
              </div>
            )}

      {/* ─── SAVE MODAL ───────────────────────────────────────────────────── */}
      {showSaveModal && (
            <div className="bt-modal-overlay" onClick={() => setShowSaveModal(false)}>
              <div className="bt-modal" onClick={e => e.stopPropagation()}>
                <h3 style={{ marginBottom: "1rem" }}>💾 Save Backtest Session</h3>
                <div className="bt-modal-field">
                  <label>Session Name *</label>
                  <input
                    value={saveForm.session_name}
                    onChange={e => setSaveForm(f => ({ ...f, session_name: e.target.value }))}
                    placeholder="e.g., RSI + Pivot v3"
                    autoFocus
                  />
                </div>
                <div className="bt-modal-field">
                  <label>Strategy Name</label>
                  <input
                    value={saveForm.strategy_name}
                    onChange={e => setSaveForm(f => ({ ...f, strategy_name: e.target.value }))}
                    placeholder="e.g., reversal_pivot_supertrend"
                  />
                </div>
                <div className="bt-modal-field">
                  <label>Tags (comma-separated)</label>
                  <input
                    value={saveForm.tags}
                    onChange={e => setSaveForm(f => ({ ...f, tags: e.target.value }))}
                    placeholder="e.g., pivot, intraday, nifty, aggressive"
                  />
                </div>
                <div className="bt-modal-field">
                  <label>Description</label>
                  <input
                    value={saveForm.description}
                    onChange={e => setSaveForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of this backtest run"
                  />
                </div>
                <div className="bt-modal-field">
                  <label>📝 Notes / Journal</label>
                  <textarea
                    value={saveForm.notes}
                    onChange={e => setSaveForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Your observations, what worked, what didn't..."
                    rows={3}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <button className="bt-save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : `💾 Save (${analysis?.tradeCount || 0} trades)`}
                  </button>
                  <button className="bt-clear-btn" onClick={() => setShowSaveModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
      )}
    </div>
  );

  // ─── Sub-components ──────────────────────────────────────────────────────────

  function KPICard({ icon, label, value, valueClass, sub, cls }) {
    return (
      <div className={`bt-kpi-card ${cls || ""}`}>
        <div className="kpi-label">{icon} {label}</div>
        <div className={`kpi-value ${valueClass || ""}`}>{value}</div>
        <div className="kpi-sub">{sub}</div>
      </div>
    );
  }

  function RiskItem({ label, value, badge, badgeClass }) {
    return (
      <div className="bt-risk-item">
        <div className="risk-label">{label}</div>
        <div className="risk-value">{value}</div>
        {badge && <span className={`risk-badge ${badgeClass || ""}`}>{badge}</span>}
      </div>
    );
  }

  function StreakItem({ label, value, emoji }) {
    return (
      <div className="bt-streak-item">
        <div className="streak-label">{label}</div>
        <div className="streak-value">{emoji} {value}</div>
      </div>
    );
  }
}

export default BacktestingPage;
