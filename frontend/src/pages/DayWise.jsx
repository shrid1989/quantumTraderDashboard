// Day-Wise Strategy Performance Page
import React, { useState, useEffect } from "react";
import { tradesAPI } from "../services/api";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import "../styles/daywise.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const STRATEGY_COLORS = [
  "#00897b",
  "#1976d2",
  "#f57c00",
  "#7b1fa2",
  "#c62828",
  "#2e7d32",
  "#0288d1",
  "#e65100",
  "#6a1b9a",
  "#b71c1c",
];

function getDayOfWeek(dateStr) {
  // dateStr: "YYYY-MM-DD"
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon...5=Fri, 6=Sat
  return day; // 1-5 for Mon-Fri
}

function getDayName(dateStr) {
  const day = getDayOfWeek(dateStr);
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return names[day];
}

function buildDayStrategyMatrix(trades) {
  // Matrix: { Monday: { Strategy1: { pnl, wins, losses, trades[] }, ... }, ... }
  const matrix = {};
  DAYS.forEach((day) => {
    matrix[day] = {};
  });

  trades.forEach((trade) => {
    const dayName = getDayName(trade.date);
    if (!DAYS.includes(dayName)) return; // skip weekends

    if (!matrix[dayName][trade.strategy]) {
      matrix[dayName][trade.strategy] = {
        pnl: 0,
        wins: 0,
        losses: 0,
        total: 0,
        trades: [],
      };
    }
    const entry = matrix[dayName][trade.strategy];
    entry.pnl += trade.pnl;
    entry.total += 1;
    if (trade.pnl > 0) entry.wins += 1;
    else if (trade.pnl < 0) entry.losses += 1;
    entry.trades.push(trade);
  });

  return matrix;
}

function getAllStrategies(trades) {
  const set = new Set(trades.map((t) => t.strategy));
  return [...set].sort();
}

// Count how many distinct calendar dates fall on each weekday
function buildDayCounts(trades) {
  const sets = {};
  DAYS.forEach((d) => (sets[d] = new Set()));
  trades.forEach((t) => {
    const dayName = getDayName(t.date);
    if (sets[dayName]) sets[dayName].add(t.date);
  });
  return Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.size]));
}

// Custom Tooltip for recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: ₹{Number(p.value).toFixed(2)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PRESETS = [
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "all", label: "All" },
  { id: "custom", label: "Custom" },
];

function applyDateFilter(trades, preset, customFrom, customTo) {
  if (preset === "all") return trades;
  const now = new Date();
  let from = null;
  let to = null;
  if (preset === "1m") {
    from = new Date(now);
    from.setMonth(from.getMonth() - 1);
  }
  if (preset === "3m") {
    from = new Date(now);
    from.setMonth(from.getMonth() - 3);
  }
  if (preset === "6m") {
    from = new Date(now);
    from.setMonth(from.getMonth() - 6);
  }
  if (preset === "1y") {
    from = new Date(now);
    from.setFullYear(from.getFullYear() - 1);
  }
  if (preset === "custom") {
    from = customFrom ? new Date(customFrom + "T00:00:00") : null;
    to = customTo ? new Date(customTo + "T23:59:59") : null;
  }
  return trades.filter((t) => {
    const d = new Date(t.date + "T00:00:00");
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

export default function DayWisePage() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null); // null = use first strategy
  const [viewMode, setViewMode] = useState("summary"); // summary | heatmap | bars | table
  const [summaryPivot, setSummaryPivot] = useState("day"); // day | strategy
  // ── Date filter ─────────────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    tradesAPI
      .getAllTrades(1000)
      .then((res) => setTrades(res.data || []))
      .catch(() => setTrades([]))
      .finally(() => setLoading(false));
  }, []);

  const handlePreset = (id) => {
    setDatePreset(id);
    setShowCustom(id === "custom");
    if (id !== "custom") {
      setCustomFrom("");
      setCustomTo("");
    }
  };

  if (loading) {
    return (
      <div className="daywise-page">
        <div className="dw-loader">
          <div className="spinner-circle"></div>
          <p>Analysing day-wise performance...</p>
        </div>
      </div>
    );
  }

  if (!trades.length) {
    return (
      <div className="daywise-page">
        <div className="dw-empty">
          <span>📭</span>
          <p>No trade data available yet. Upload some trades first.</p>
        </div>
      </div>
    );
  }

  const filteredTrades = applyDateFilter(
    trades,
    datePreset,
    customFrom,
    customTo,
  );

  const matrix = buildDayStrategyMatrix(filteredTrades);
  const strategies = getAllStrategies(filteredTrades);
  const dayCounts = buildDayCounts(filteredTrades);

  // ── Heatmap cell colour ──────────────────────────────────────────────────
  const cellColor = (pnl, maxAbs) => {
    if (pnl === undefined || pnl === null) return "transparent";
    const intensity = maxAbs > 0 ? Math.min(Math.abs(pnl) / maxAbs, 1) : 0;
    if (pnl > 0) return `rgba(16,185,129,${0.12 + intensity * 0.65})`;
    if (pnl < 0) return `rgba(239,68,68,${0.12 + intensity * 0.65})`;
    return "rgba(255,255,255,0.04)";
  };

  // max absolute PnL across entire matrix for colour scaling
  let maxAbs = 0;
  DAYS.forEach((day) =>
    strategies.forEach((s) => {
      const val = matrix[day][s]?.pnl;
      if (val !== undefined) maxAbs = Math.max(maxAbs, Math.abs(val));
    }),
  );

  // ── Bar-chart data (per day, each strategy is a bar group) ──────────────
  const barData = DAYS.map((day, i) => {
    const row = { day: DAY_SHORT[i] };
    strategies.forEach((s) => {
      row[s] = matrix[day][s]?.pnl ? Number(matrix[day][s].pnl.toFixed(2)) : 0;
    });
    return row;
  });

  // ── Line chart: selected strategy across days ────────────────────────────
  const lineData = DAYS.map((day, i) => {
    const row = { day: DAY_SHORT[i] };
    const activeStrat = selectedStrategy || strategies[0];
    const toShow = activeStrat === "all" ? strategies : [activeStrat];
    toShow.forEach((s) => {
      row[s] = matrix[day][s]?.pnl ? Number(matrix[day][s].pnl.toFixed(2)) : 0;
    });
    return row;
  });

  // ── Summary cards for the selected day ──────────────────────────────────
  const daySummary = selectedDay
    ? strategies
        .filter((s) => matrix[selectedDay][s])
        .map((s) => ({
          strategy: s,
          ...matrix[selectedDay][s],
          winRate:
            matrix[selectedDay][s].total > 0
              ? (
                  (matrix[selectedDay][s].wins / matrix[selectedDay][s].total) *
                  100
                ).toFixed(1)
              : 0,
        }))
        .sort((a, b) => b.pnl - a.pnl)
    : null;

  // ── Day totals ───────────────────────────────────────────────────────────
  const dayTotals = DAYS.map((day) => {
    const entries = Object.values(matrix[day]);
    const pnl = entries.reduce((s, e) => s + e.pnl, 0);
    const trades = entries.reduce((s, e) => s + e.total, 0);
    const wins = entries.reduce((s, e) => s + e.wins, 0);
    return {
      day,
      pnl,
      trades,
      winRate: trades > 0 ? ((wins / trades) * 100).toFixed(1) : 0,
    };
  });

  const bestDay = [...dayTotals].sort((a, b) => b.pnl - a.pnl)[0];
  const worstDay = [...dayTotals].sort((a, b) => a.pnl - b.pnl)[0];

  // ── Best day per strategy (and worst) ───────────────────────────────────
  // For each strategy, find which weekday has the highest cumulative PnL
  const bestDayPerStrategy = {}; // { strategyName: { day, pnl, winRate, total } }
  const worstDayPerStrategy = {};
  strategies.forEach((s) => {
    const dayStats = DAYS.map((day) => ({
      day,
      pnl: matrix[day][s]?.pnl ?? null,
      total: matrix[day][s]?.total ?? 0,
      wins: matrix[day][s]?.wins ?? 0,
      losses: matrix[day][s]?.losses ?? 0,
    })).filter((d) => d.pnl !== null);
    if (!dayStats.length) return;
    const sorted = [...dayStats].sort((a, b) => b.pnl - a.pnl);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    bestDayPerStrategy[s] = {
      ...best,
      winRate: best.total > 0 ? ((best.wins / best.total) * 100).toFixed(1) : 0,
    };
    worstDayPerStrategy[s] = {
      ...worst,
      winRate:
        worst.total > 0 ? ((worst.wins / worst.total) * 100).toFixed(1) : 0,
    };
  });

  return (
    <div className="daywise-page">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="dw-header">
        <div>
          <h1>📅 Day-Wise Strategy Performance</h1>
          <p className="dw-subtitle">
            Discover which strategies excel on each trading day (Mon – Fri)
          </p>
        </div>
        <div className="dw-view-toggle">
          {[
            { id: "summary", label: "🏅 Summary" },
            { id: "heatmap", label: "🔥 Heatmap" },
            { id: "bars", label: "📊 Bar Chart" },
            { id: "table", label: "📋 Table" },
          ].map(({ id, label }) => (
            <button
              key={id}
              className={`view-btn ${viewMode === id ? "active" : ""}`}
              onClick={() => setViewMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Date Range Filter ─────────────────────────────── */}
      <div className="dw-filter-bar">
        <div className="dw-filter-presets">
          {PRESETS.map(({ id, label }) => (
            <button
              key={id}
              className={`dw-preset-btn ${datePreset === id ? "active" : ""}`}
              onClick={() => handlePreset(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {showCustom && (
          <div className="dw-custom-range">
            <label className="dw-custom-label">From</label>
            <input
              type="date"
              className="dw-date-input"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <label className="dw-custom-label">To</label>
            <input
              type="date"
              className="dw-date-input"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}
        {datePreset !== "all" && filteredTrades.length > 0 && (
          <div className="dw-filter-badge">{filteredTrades.length} trades</div>
        )}
        {datePreset !== "all" && filteredTrades.length === 0 && (
          <div className="dw-filter-badge empty">No trades in range</div>
        )}
      </div>

      {/* ── Quick-stat strip ─────────────────────────────────── */}
      <div className="dw-stat-strip">
        {dayTotals.map(({ day, pnl, trades, winRate }) => (
          <button
            key={day}
            className={`dw-day-pill ${selectedDay === day ? "active" : ""} ${pnl >= 0 ? "positive" : "negative"}`}
            onClick={() => setSelectedDay(selectedDay === day ? null : day)}
          >
            <span className="pill-day">{day.slice(0, 3)}</span>
            <span className={`pill-pnl ${pnl >= 0 ? "positive" : "negative"}`}>
              {pnl >= 0 ? "+" : ""}₹{pnl.toFixed(0)}
            </span>
            <span className="pill-meta">
              {trades}T · {winRate}%
            </span>
          </button>
        ))}
        <div className="dw-best-worst">
          <div className="bw-item best">
            <span>🏆 Best</span>
            <strong>{bestDay.day.slice(0, 3)}</strong>
          </div>
          <div className="bw-item worst">
            <span>⚠️ Worst</span>
            <strong>{worstDay.day.slice(0, 3)}</strong>
          </div>
        </div>
      </div>

      {/* ── Detail panel for selected day ────────────────────── */}
      {selectedDay && daySummary && (
        <div className="dw-day-detail">
          <div className="detail-header">
            <h2>📅 {selectedDay} — breakdown by strategy</h2>
            <button className="close-btn" onClick={() => setSelectedDay(null)}>
              ✕
            </button>
          </div>
          <div className="detail-cards">
            {daySummary.map((s, i) => (
              <div
                key={s.strategy}
                className={`detail-card ${s.pnl >= 0 ? "win" : "lose"}`}
              >
                <div className="dc-rank">#{i + 1}</div>
                <div className="dc-strategy">{s.strategy}</div>
                <div
                  className={`dc-pnl ${s.pnl >= 0 ? "positive" : "negative"}`}
                >
                  {s.pnl >= 0 ? "+" : ""}₹{s.pnl.toFixed(2)}
                </div>
                <div className="dc-stats">
                  <span>{s.total} trades</span>
                  <span className="dc-wins">✅ {s.wins}</span>
                  <span className="dc-losses">❌ {s.losses}</span>
                </div>
                <div className="dc-winrate-bar">
                  <div
                    className="dc-winrate-fill"
                    style={{ width: `${s.winRate}%` }}
                  />
                </div>
                <div className="dc-winrate-label">{s.winRate}% win rate</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SUMMARY VIEW ──────────────────────────────────────── */}
      {viewMode === "summary" && (
        <div className="dw-section">
          {/* ── Insights: best day per strategy ───────────────── */}
          {strategies.length > 0 &&
            Object.keys(bestDayPerStrategy).length > 0 && (
              <div className="insights-panel">
                <div className="insights-title">
                  🏆 Best Trading Day — by Strategy
                </div>
                <div className="insights-grid">
                  {strategies.map((s, i) => {
                    const best = bestDayPerStrategy[s];
                    const worst = worstDayPerStrategy[s];
                    if (!best) return null;
                    const color = STRATEGY_COLORS[i % STRATEGY_COLORS.length];
                    return (
                      <div
                        key={s}
                        className="insight-card"
                        style={{ "--ins-color": color }}
                      >
                        <div className="insight-strategy">
                          <span
                            className="insight-dot"
                            style={{ background: color }}
                          />
                          <span className="insight-name" title={s}>
                            {s}
                          </span>
                        </div>
                        <div className="insight-body">
                          <div className="insight-best">
                            <span className="insight-day-badge best">
                              {best.day.slice(0, 3)}
                            </span>
                            <div className="insight-nums">
                              <span className="insight-pnl pos">
                                {best.pnl >= 0 ? "+" : ""}₹
                                {Math.abs(best.pnl) >= 10000
                                  ? (best.pnl / 1000).toFixed(1) + "k"
                                  : best.pnl.toFixed(0)}
                              </span>
                              <span className="insight-meta">
                                {best.total}T · {best.winRate}% WR
                              </span>
                            </div>
                          </div>
                          {worst && worst.day !== best.day && (
                            <div className="insight-worst">
                              <span className="insight-day-badge worst">
                                {worst.day.slice(0, 3)}
                              </span>
                              <div className="insight-nums">
                                <span className="insight-pnl neg">
                                  {worst.pnl >= 0 ? "+" : ""}₹
                                  {Math.abs(worst.pnl) >= 10000
                                    ? (worst.pnl / 1000).toFixed(1) + "k"
                                    : worst.pnl.toFixed(0)}
                                </span>
                                <span className="insight-meta">
                                  {worst.total}T · {worst.winRate}% WR
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Pivot toggle */}
          <div className="summary-pivot-bar">
            <div className="summary-pivot-label">View by:</div>
            <div className="summary-pivot-toggle">
              <button
                className={`pivot-btn ${summaryPivot === "day" ? "active" : ""}`}
                onClick={() => setSummaryPivot("day")}
              >
                📅 Day
              </button>
              <button
                className={`pivot-btn ${summaryPivot === "strategy" ? "active" : ""}`}
                onClick={() => setSummaryPivot("strategy")}
              >
                🎯 Strategy
              </button>
            </div>
          </div>

          {/* ── BY DAY: each day → list every strategy's PnL ── */}
          {summaryPivot === "day" && (
            <div className="breakdown-columns">
              {DAYS.map((day) => {
                const rows = strategies
                  .filter((s) => matrix[day][s])
                  .map((s) => ({
                    strategy: s,
                    colorIdx: strategies.indexOf(s),
                    pnl: matrix[day][s].pnl,
                    total: matrix[day][s].total,
                    wins: matrix[day][s].wins,
                    losses: matrix[day][s].losses,
                    winRate:
                      matrix[day][s].total > 0
                        ? (
                            (matrix[day][s].wins / matrix[day][s].total) *
                            100
                          ).toFixed(1)
                        : "0.0",
                  }))
                  .sort((a, b) => b.pnl - a.pnl);

                if (!rows.length) return null;

                const dayTotal = rows.reduce((acc, r) => acc + r.pnl, 0);
                const occurrences = dayCounts[day] || 0;
                const maxAbs = Math.max(...rows.map((r) => Math.abs(r.pnl)));

                return (
                  <div key={day} className="bd-day-column">
                    {/* Day header */}
                    <div
                      className={`bd-day-header ${dayTotal >= 0 ? "pos" : "neg"}`}
                    >
                      <span className="bd-day-name">{day}</span>
                      <div className="bd-day-meta">
                        <span className="bd-day-sessions">
                          {occurrences} sessions
                        </span>
                        <span
                          className={`bd-day-total ${dayTotal >= 0 ? "pos" : "neg"}`}
                        >
                          {dayTotal >= 0 ? "+" : ""}₹
                          {Math.abs(dayTotal) >= 1000
                            ? (dayTotal / 1000).toFixed(1) + "k"
                            : dayTotal.toFixed(0)}
                        </span>
                      </div>
                    </div>

                    {/* One block per strategy */}
                    <div className="bd-strategy-list">
                      {rows.map((r, rank) => {
                        const isBestForThisStrategy =
                          bestDayPerStrategy[r.strategy]?.day === day;
                        return (
                          <div
                            key={r.strategy}
                            className={`bd-strategy-block ${r.pnl >= 0 ? "profit" : "loss"}${isBestForThisStrategy ? " champion" : ""}`}
                          >
                            {/* Coloured left strip */}
                            <div
                              className="bd-color-strip"
                              style={{
                                background:
                                  STRATEGY_COLORS[
                                    r.colorIdx % STRATEGY_COLORS.length
                                  ],
                              }}
                            />
                            <div className="bd-block-inner">
                              <div className="bd-strategy-name">
                                <span className="bd-rank">#{rank + 1}</span>
                                {r.strategy}
                              </div>
                              <div
                                className={`bd-pnl ${r.pnl >= 0 ? "pos" : "neg"}`}
                              >
                                {r.pnl >= 0 ? "+" : ""}₹
                                {Math.abs(r.pnl) >= 10000
                                  ? (r.pnl / 1000).toFixed(1) + "k"
                                  : r.pnl.toFixed(2)}
                              </div>
                              {/* Proportion bar */}
                              <div className="bd-prop-bar">
                                <div
                                  className="bd-prop-fill"
                                  style={{
                                    width:
                                      maxAbs > 0
                                        ? `${(Math.abs(r.pnl) / maxAbs) * 100}%`
                                        : "0%",
                                    background:
                                      STRATEGY_COLORS[
                                        r.colorIdx % STRATEGY_COLORS.length
                                      ],
                                    opacity: r.pnl >= 0 ? 0.85 : 0.5,
                                  }}
                                />
                              </div>
                              <div className="bd-sub-stats">
                                <span>{r.total} trades</span>
                                <span className="bd-wr">{r.winRate}% WR</span>
                              </div>
                              {isBestForThisStrategy && (
                                <div className="bd-best-badge">
                                  🏆 Best day for this strategy
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── BY STRATEGY: pick a strategy → Mon–Fri cards ── */}
          {summaryPivot === "strategy" && (
            <>
              {/* Strategy tabs */}
              <div className="strat-tab-row">
                {strategies.map((s, i) => (
                  <button
                    key={s}
                    className={`strat-tab ${
                      (selectedStrategy || strategies[0]) === s ? "active" : ""
                    }`}
                    style={{
                      "--stab-color":
                        STRATEGY_COLORS[i % STRATEGY_COLORS.length],
                    }}
                    onClick={() => setSelectedStrategy(s)}
                  >
                    <span
                      className="stab-dot"
                      style={{
                        background: STRATEGY_COLORS[i % STRATEGY_COLORS.length],
                      }}
                    />
                    {s}
                  </button>
                ))}
              </div>

              {/* Day cards for selected strategy */}
              {(() => {
                const strat = selectedStrategy || strategies[0];
                const stratIdx = strategies.indexOf(strat);
                const color =
                  STRATEGY_COLORS[stratIdx % STRATEGY_COLORS.length];
                const stratTotal = DAYS.reduce(
                  (acc, d) => acc + (matrix[d][strat]?.pnl || 0),
                  0,
                );

                return (
                  <>
                    <div className="strat-overview">
                      <span className="strat-overview-name" style={{ color }}>
                        {strat}
                      </span>
                      <span className="strat-overview-label">
                        Overall total across all days:
                      </span>
                      <span
                        className={`strat-overview-total ${stratTotal >= 0 ? "pos" : "neg"}`}
                      >
                        {stratTotal >= 0 ? "+" : ""}₹{stratTotal.toFixed(2)}
                      </span>
                    </div>

                    <div className="strat-day-row">
                      {DAYS.map((day, di) => {
                        const entry = matrix[day][strat];
                        const pnl = entry?.pnl ?? null;
                        const occurrences = dayCounts[day] || 0;
                        const isBest = bestDayPerStrategy[strat]?.day === day;
                        const isWorst = worstDayPerStrategy[strat]?.day === day;
                        return (
                          <div
                            key={day}
                            className={`strat-day-card ${
                              pnl === null
                                ? "empty"
                                : pnl >= 0
                                  ? "profit"
                                  : "loss"
                            }${isBest ? " best-day" : ""}${isWorst && !isBest ? " worst-day" : ""}`}
                            style={{ "--card-color": color }}
                          >
                            <div className="sdc-day">{DAY_SHORT[di]}</div>
                            {pnl !== null ? (
                              <>
                                {isBest && (
                                  <div className="sdc-crown">🏆 Best</div>
                                )}
                                {isWorst && !isBest && (
                                  <div className="sdc-crown worst">
                                    ⚠️ Worst
                                  </div>
                                )}
                                <div
                                  className={`sdc-pnl ${pnl >= 0 ? "pos" : "neg"}`}
                                >
                                  {pnl >= 0 ? "+" : ""}₹
                                  {Math.abs(pnl) >= 10000
                                    ? (pnl / 1000).toFixed(1) + "k"
                                    : pnl.toFixed(2)}
                                </div>
                                <div className="sdc-stats">
                                  <span>{entry.total}T</span>
                                  <span className="sdc-wr">
                                    {entry.total > 0
                                      ? (
                                          (entry.wins / entry.total) *
                                          100
                                        ).toFixed(0)
                                      : 0}
                                    % WR
                                  </span>
                                </div>
                                <div className="sdc-wins-losses">
                                  <span className="sdc-w">✅{entry.wins}</span>
                                  <span className="sdc-l">
                                    ❌{entry.losses}
                                  </span>
                                </div>
                                <div className="sdc-sessions">
                                  {occurrences} sessions
                                </div>
                              </>
                            ) : (
                              <div className="sdc-empty">No trades</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ── HEATMAP VIEW ─────────────────────────────────────── */}
      {viewMode === "heatmap" && (
        <div className="dw-section">
          <h2 className="section-title">🔥 P&L Heatmap — Strategy × Day</h2>
          <p className="section-sub">
            Green = profit · Red = loss · Darker = larger magnitude
          </p>

          <div className="heatmap-wrapper">
            <table className="heatmap-table">
              <thead>
                <tr>
                  <th className="hm-corner">Strategy \ Day</th>
                  {DAYS.map((d, i) => (
                    <th
                      key={d}
                      className={`hm-day-header ${selectedDay === d ? "selected" : ""}`}
                      onClick={() =>
                        setSelectedDay(selectedDay === d ? null : d)
                      }
                    >
                      {DAY_SHORT[i]}
                    </th>
                  ))}
                  <th className="hm-total-header">Total</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s, si) => {
                  const rowTotal = DAYS.reduce(
                    (sum, d) => sum + (matrix[d][s]?.pnl || 0),
                    0,
                  );
                  return (
                    <tr key={s}>
                      <td className="hm-strategy-label">
                        <span
                          className="strategy-dot"
                          style={{
                            background:
                              STRATEGY_COLORS[si % STRATEGY_COLORS.length],
                          }}
                        />
                        {s}
                      </td>
                      {DAYS.map((d) => {
                        const entry = matrix[d][s];
                        const pnl = entry?.pnl;
                        return (
                          <td
                            key={d}
                            className={`hm-cell ${pnl === undefined ? "empty" : ""} ${selectedDay === d ? "day-selected" : ""}`}
                            style={{ background: cellColor(pnl, maxAbs) }}
                            title={
                              entry
                                ? `${s} on ${d}: ₹${pnl.toFixed(2)} | ${entry.total} trades | ${entry.wins}W ${entry.losses}L`
                                : "No trades"
                            }
                          >
                            {entry ? (
                              <div className="hm-cell-inner">
                                <span
                                  className={`hm-pnl ${pnl >= 0 ? "pos" : "neg"}`}
                                >
                                  {pnl >= 0 ? "+" : ""}₹
                                  {Math.abs(pnl) >= 1000
                                    ? (pnl / 1000).toFixed(1) + "k"
                                    : pnl.toFixed(0)}
                                </span>
                                <span className="hm-trades">
                                  {entry.total}T
                                </span>
                              </div>
                            ) : (
                              <span className="hm-na">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td
                        className={`hm-row-total ${rowTotal >= 0 ? "pos" : "neg"}`}
                      >
                        {rowTotal >= 0 ? "+" : ""}₹{rowTotal.toFixed(0)}
                      </td>
                    </tr>
                  );
                })}
                {/* Column totals */}
                <tr className="hm-total-row">
                  <td className="hm-strategy-label hm-total-label">
                    Day Total
                  </td>
                  {dayTotals.map(({ day, pnl }) => (
                    <td
                      key={day}
                      className={`hm-col-total ${pnl >= 0 ? "pos" : "neg"}`}
                    >
                      {pnl >= 0 ? "+" : ""}₹{pnl.toFixed(0)}
                    </td>
                  ))}
                  <td className="hm-col-total grand-total">
                    ₹{dayTotals.reduce((s, d) => s + d.pnl, 0).toFixed(0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── BAR CHART VIEW ───────────────────────────────────── */}
      {viewMode === "bars" && (
        <div className="dw-section">
          <div className="section-title-row">
            <h2 className="section-title">📊 Grouped Bar Chart</h2>
            <div className="strategy-filter">
              <select
                value={selectedStrategy || ""}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="dw-select"
              >
                <option value="all">All Strategies (Line)</option>
                {strategies.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedStrategy === "all" || !selectedStrategy ? (
            /* All strategies: grouped bars per day */
            <div className="chart-card">
              <h3>P&L by Day — All Strategies</h3>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={barData} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="day" tick={{ fill: "#b0b0b0" }} />
                  <YAxis
                    tick={{ fill: "#b0b0b0" }}
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {strategies.map((s, i) => (
                    <Bar
                      key={s}
                      dataKey={s}
                      stackId={null}
                      fill={STRATEGY_COLORS[i % STRATEGY_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            /* Single strategy: line across Mon–Fri */
            <div className="chart-card">
              <h3>
                Daily P&L Trend for{" "}
                <span
                  style={{
                    color:
                      STRATEGY_COLORS[
                        strategies.indexOf(selectedStrategy) %
                          STRATEGY_COLORS.length
                      ],
                  }}
                >
                  {selectedStrategy}
                </span>
              </h3>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="day" tick={{ fill: "#b0b0b0" }} />
                  <YAxis
                    tick={{ fill: "#b0b0b0" }}
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey={selectedStrategy}
                    stroke={
                      STRATEGY_COLORS[
                        strategies.indexOf(selectedStrategy) %
                          STRATEGY_COLORS.length
                      ]
                    }
                    strokeWidth={3}
                    dot={{ r: 7, strokeWidth: 2 }}
                    activeDot={{ r: 10 }}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-strategy small bar charts */}
          <div className="mini-chart-grid">
            {strategies.map((s, si) => {
              const data = DAYS.map((day, i) => ({
                day: DAY_SHORT[i],
                pnl: matrix[day][s]?.pnl
                  ? Number(matrix[day][s].pnl.toFixed(2))
                  : 0,
              }));
              const total = data.reduce((acc, d) => acc + d.pnl, 0);
              return (
                <div key={s} className="mini-chart-card">
                  <div className="mini-chart-header">
                    <span
                      className="mini-dot"
                      style={{
                        background:
                          STRATEGY_COLORS[si % STRATEGY_COLORS.length],
                      }}
                    />
                    <span className="mini-name">{s}</span>
                    <span
                      className={`mini-total ${total >= 0 ? "pos" : "neg"}`}
                    >
                      {total >= 0 ? "+" : ""}₹{total.toFixed(0)}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={data} barSize={18}>
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: "#888" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v) => `₹${v}`}
                        contentStyle={{
                          backgroundColor: "#1a1a1a",
                          border: "1px solid #333",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.pnl >= 0
                                ? STRATEGY_COLORS[si % STRATEGY_COLORS.length]
                                : "#ef4444"
                            }
                            opacity={entry.pnl === 0 ? 0.2 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ───────────────────────────────────────── */}
      {viewMode === "table" && (
        <div className="dw-section">
          <h2 className="section-title">📋 Detailed Stats Table</h2>
          <div className="dw-table-wrapper">
            {DAYS.map((day) => {
              const rows = strategies
                .filter((s) => matrix[day][s])
                .map((s) => ({
                  strategy: s,
                  ...matrix[day][s],
                  winRate:
                    matrix[day][s].total > 0
                      ? (
                          (matrix[day][s].wins / matrix[day][s].total) *
                          100
                        ).toFixed(1)
                      : "0.0",
                }))
                .sort((a, b) => b.pnl - a.pnl);

              const dayTotal = rows.reduce((s, r) => s + r.pnl, 0);

              if (!rows.length) return null;

              return (
                <div key={day} className="day-table-block">
                  <div
                    className={`day-table-title ${dayTotal >= 0 ? "pos" : "neg"}`}
                  >
                    <span>{day}</span>
                    <span>
                      Total: {dayTotal >= 0 ? "+" : ""}₹{dayTotal.toFixed(2)}
                    </span>
                  </div>
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>Strategy</th>
                        <th>P&L</th>
                        <th>Trades</th>
                        <th>Wins</th>
                        <th>Losses</th>
                        <th>Win Rate</th>
                        <th>Avg P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr
                          key={r.strategy}
                          className={r.pnl >= 0 ? "row-win" : "row-loss"}
                        >
                          <td className="strategy-cell">
                            <span
                              className="strategy-dot"
                              style={{
                                background:
                                  STRATEGY_COLORS[
                                    strategies.indexOf(r.strategy) %
                                      STRATEGY_COLORS.length
                                  ],
                              }}
                            />
                            {r.strategy}
                          </td>
                          <td className={r.pnl >= 0 ? "pnl-pos" : "pnl-neg"}>
                            {r.pnl >= 0 ? "+" : ""}₹{r.pnl.toFixed(2)}
                          </td>
                          <td>{r.total}</td>
                          <td className="wins-cell">✅ {r.wins}</td>
                          <td className="losses-cell">❌ {r.losses}</td>
                          <td>
                            <div className="win-rate-cell">
                              <div className="wr-bar">
                                <div
                                  className="wr-fill"
                                  style={{ width: `${r.winRate}%` }}
                                />
                              </div>
                              <span>{r.winRate}%</span>
                            </div>
                          </td>
                          <td
                            className={
                              r.pnl / r.total >= 0 ? "pnl-pos" : "pnl-neg"
                            }
                          >
                            ₹{(r.pnl / r.total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
