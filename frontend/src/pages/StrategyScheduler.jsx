// Strategy Scheduler — On/Off Strategy Deployment Manager
import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { schedulerAPI } from "../services/api";
import "../styles/scheduler.css";

const STRATEGY_LABELS = {
  straddle_time1: { name: "Straddle Time 1", desc: "Short Straddle — 10:00 AM Entry" },
  straddle_time2: { name: "Straddle Time 2", desc: "Short Straddle — 10:50 AM Entry" },
  reversal_pivot_supertrend: { name: "Pivot Reversal", desc: "Pivot Multi-Level Intraday Reversal" },
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_FULL_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function StrategyScheduler() {
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [strategies, setStrategies] = useState([]);
  // scheduleMap: { "straddle_time1": [0,1,2,3,4], "straddle_time2": [0,1,3,4] }
  const [scheduleMap, setScheduleMap] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [todayInfo, setTodayInfo] = useState(null);

  // Overrides state
  const [overrides, setOverrides] = useState([]);
  const [newOverride, setNewOverride] = useState({
    strategy_name: "",
    specific_date: "",
    is_active: false,
  });
  const [addingOverride, setAddingOverride] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [strategiesRes, schedulesRes, overridesRes, todayRes] = await Promise.all([
        schedulerAPI.getKnownStrategies(),
        schedulerAPI.getSchedules(),
        schedulerAPI.getOverrides(),
        schedulerAPI.getTodayActive(),
      ]);

      const strats = strategiesRes.data;
      setStrategies(strats);

      // Build map from schedules (1 row per strategy)
      const map = {};
      strats.forEach((s) => {
        map[s] = [0, 1, 2, 3, 4]; // default all active
      });

      // Apply saved schedules
      (schedulesRes.data || []).forEach((row) => {
        if (row.strategy_name in map) {
          map[row.strategy_name] = row.active_days || [];
        }
      });

      setScheduleMap(map);
      setOverrides(overridesRes.data || []);
      setTodayInfo(todayRes.data);
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to load scheduler data:", err);
      toast.error("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if a day is active for a strategy
  const isDayActive = (strategy, day) => {
    return (scheduleMap[strategy] || []).includes(day);
  };

  // Toggle a single day for a strategy
  const handleToggle = (strategy, day) => {
    setScheduleMap((prev) => {
      const currentDays = [...(prev[strategy] || [])];
      const idx = currentDays.indexOf(day);
      if (idx >= 0) {
        currentDays.splice(idx, 1); // remove day
      } else {
        currentDays.push(day); // add day
        currentDays.sort();
      }
      return { ...prev, [strategy]: currentDays };
    });
    setHasChanges(true);
  };

  // Toggle entire row (all days for a strategy)
  const handleToggleRow = (strategy) => {
    const currentDays = scheduleMap[strategy] || [];
    const allActive = currentDays.length === 5;
    setScheduleMap((prev) => ({
      ...prev,
      [strategy]: allActive ? [] : [0, 1, 2, 3, 4],
    }));
    setHasChanges(true);
  };

  // Toggle entire column (all strategies for a day)
  const handleToggleColumn = (day) => {
    const allActive = strategies.every((s) => isDayActive(s, day));
    setScheduleMap((prev) => {
      const updated = { ...prev };
      strategies.forEach((s) => {
        const days = [...(updated[s] || [])];
        const idx = days.indexOf(day);
        if (allActive && idx >= 0) {
          days.splice(idx, 1);
        } else if (!allActive && idx < 0) {
          days.push(day);
          days.sort();
        }
        updated[s] = days;
      });
      return updated;
    });
    setHasChanges(true);
  };

  // Save schedule
  const handleSave = async () => {
    try {
      setSaving(true);
      const schedules = strategies.map((strategy) => ({
        strategy_name: strategy,
        active_days: scheduleMap[strategy] || [],
      }));

      await schedulerAPI.bulkUpdateSchedules(schedules);
      toast.success("Schedule saved successfully!");
      setHasChanges(false);

      // Refresh today's active
      const todayRes = await schedulerAPI.getTodayActive();
      setTodayInfo(todayRes.data);
    } catch (err) {
      console.error("Failed to save schedule:", err);
      toast.error("Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  // Add override
  const handleAddOverride = async () => {
    if (!newOverride.strategy_name || !newOverride.specific_date) {
      toast.error("Please select strategy and date");
      return;
    }

    try {
      setAddingOverride(true);
      await schedulerAPI.createOverride(newOverride);
      toast.success(
        `Override added: ${STRATEGY_LABELS[newOverride.strategy_name]?.name || newOverride.strategy_name} on ${newOverride.specific_date}`
      );
      setNewOverride({ strategy_name: "", specific_date: "", is_active: false });

      // Refresh
      const [overridesRes, todayRes] = await Promise.all([
        schedulerAPI.getOverrides(),
        schedulerAPI.getTodayActive(),
      ]);
      setOverrides(overridesRes.data || []);
      setTodayInfo(todayRes.data);
    } catch (err) {
      console.error("Failed to add override:", err);
      toast.error("Failed to add override");
    } finally {
      setAddingOverride(false);
    }
  };

  // Delete override
  const handleDeleteOverride = async (id) => {
    try {
      await schedulerAPI.deleteOverride(id);
      toast.success("Override removed");

      const [overridesRes, todayRes] = await Promise.all([
        schedulerAPI.getOverrides(),
        schedulerAPI.getTodayActive(),
      ]);
      setOverrides(overridesRes.data || []);
      setTodayInfo(todayRes.data);
    } catch (err) {
      console.error("Failed to delete override:", err);
      toast.error("Failed to delete override");
    }
  };

  // Count active strategies for a day
  const getActiveCount = (day) => {
    return strategies.filter((s) => isDayActive(s, day)).length;
  };

  if (loading) {
    return (
      <div className="scheduler-page">
        <h1>🗓️ Strategy Scheduler</h1>
        <div className="scheduler-loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="scheduler-page">
      <h1>🗓️ Strategy Scheduler</h1>
      <p className="scheduler-subtitle">
        Control which trading strategies run each day. Changes take effect on
        the next trading session.
      </p>

      {/* ── Today's Status Banner ── */}
      {todayInfo && (
        <div className="today-banner">
          <span className="today-banner-icon">📡</span>
          <div className="today-banner-content">
            <h3>
              Today — {todayInfo.day_name}, {todayInfo.date}
            </h3>
            <p>
              {todayInfo.active_strategies.length} of {strategies.length}{" "}
              strategies active
            </p>
            <div className="today-banner-chips">
              {strategies.map((s) => (
                <span
                  key={s}
                  className={`strategy-chip ${
                    todayInfo.active_strategies.includes(s)
                      ? "active"
                      : "inactive"
                  }`}
                >
                  {todayInfo.active_strategies.includes(s) ? "●" : "○"}{" "}
                  {STRATEGY_LABELS[s]?.name || s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Section 1: Weekly Schedule Grid ── */}
      <div className="scheduler-section">
        <div className="section-header">
          <h2>📅 Weekly Schedule</h2>
          <button
            className={`save-btn ${saving ? "saving" : ""}`}
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? "⏳ Saving..." : "💾 Save Schedule"}
          </button>
        </div>

        <div className="schedule-grid-card">
          <table className="schedule-grid">
            <thead>
              <tr>
                <th>Strategy</th>
                {DAY_NAMES.map((day, idx) => (
                  <th
                    key={day}
                    style={{ cursor: "pointer" }}
                    onClick={() => handleToggleColumn(idx)}
                    title={`Click to toggle all strategies for ${DAY_FULL_NAMES[idx]}`}
                  >
                    {day}
                    <br />
                    <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                      {getActiveCount(idx)}/{strategies.length}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {strategies.map((strategy) => (
                <tr key={strategy}>
                  <td>
                    <div className="strategy-name-cell">
                      <span
                        className="strategy-name"
                        style={{ cursor: "pointer" }}
                        onClick={() => handleToggleRow(strategy)}
                        title="Click to toggle all days"
                      >
                        {STRATEGY_LABELS[strategy]?.name || strategy}
                      </span>
                      <span className="strategy-desc">
                        {STRATEGY_LABELS[strategy]?.desc || ""}
                      </span>
                    </div>
                  </td>
                  {DAY_NAMES.map((_, dayIdx) => (
                    <td key={dayIdx}>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={isDayActive(strategy, dayIdx)}
                          onChange={() => handleToggle(strategy, dayIdx)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 2: Date-Specific Overrides ── */}
      <div className="scheduler-section">
        <div className="section-header">
          <h2>🎯 Date-Specific Overrides</h2>
        </div>

        <div className="override-form">
          <div className="override-form-row">
            <div className="override-field">
              <label>Strategy</label>
              <select
                value={newOverride.strategy_name}
                onChange={(e) =>
                  setNewOverride((prev) => ({
                    ...prev,
                    strategy_name: e.target.value,
                  }))
                }
              >
                <option value="">Select strategy...</option>
                {strategies.map((s) => (
                  <option key={s} value={s}>
                    {STRATEGY_LABELS[s]?.name || s}
                  </option>
                ))}
              </select>
            </div>

            <div className="override-field">
              <label>Date</label>
              <input
                type="date"
                value={newOverride.specific_date}
                onChange={(e) =>
                  setNewOverride((prev) => ({
                    ...prev,
                    specific_date: e.target.value,
                  }))
                }
              />
            </div>

            <div className="override-field">
              <label>Action</label>
              <div className="override-action-select">
                <button
                  className={`override-action-btn disable-btn ${
                    !newOverride.is_active ? "selected" : ""
                  }`}
                  onClick={() =>
                    setNewOverride((prev) => ({ ...prev, is_active: false }))
                  }
                >
                  🔴 Disable
                </button>
                <button
                  className={`override-action-btn enable-btn ${
                    newOverride.is_active ? "selected" : ""
                  }`}
                  onClick={() =>
                    setNewOverride((prev) => ({ ...prev, is_active: true }))
                  }
                >
                  🟢 Enable
                </button>
              </div>
            </div>

            <button
              className="add-override-btn"
              onClick={handleAddOverride}
              disabled={
                addingOverride ||
                !newOverride.strategy_name ||
                !newOverride.specific_date
              }
            >
              {addingOverride ? "Adding..." : "+ Add Override"}
            </button>
          </div>
        </div>

        {/* Overrides List */}
        <div className="overrides-list">
          {overrides.length === 0 ? (
            <div className="empty-overrides">
              No date-specific overrides configured. Add one above to override
              the weekly schedule for a specific date.
            </div>
          ) : (
            overrides.map((o) => (
              <div className="override-card" key={o.id}>
                <div className="override-info">
                  <span className="override-date-badge">
                    {o.specific_date}
                  </span>
                  <span className="override-strategy-name">
                    {STRATEGY_LABELS[o.strategy_name]?.name || o.strategy_name}
                  </span>
                  <span
                    className={`override-status ${
                      o.is_active ? "enabled" : "disabled"
                    }`}
                  >
                    {o.is_active ? "🟢 Force ON" : "🔴 Force OFF"}
                  </span>
                </div>
                <button
                  className="delete-override-btn"
                  onClick={() => handleDeleteOverride(o.id)}
                >
                  ✕ Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default StrategyScheduler;
