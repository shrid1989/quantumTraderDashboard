/**
 * QuantumTrader — Backtest Analytics Engine
 * 
 * Pure client-side analytics for backtesting results.
 * No backend / Supabase dependency — all computed in-browser.
 */

// ─── CSV PARSING ─────────────────────────────────────────────────────────────

// Backtesting CSV format
const REQUIRED_COLUMNS = [
  'date', 'position', 'nifty_at_entry', 'entry_reason',
  'entry_time', 'entry_price', 'exit_time', 'exit_price',
  'exit_reason', 'pnl_pts', 'pnl_inr', 'trade_duration'
];


export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  // Auto-detect delimiter: tab or comma
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  // Parse header
  const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());

  // Validate required columns
  const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }

  // Parse rows
  const trades = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by detected delimiter (handle quoted fields for comma)
    const values = delimiter === '\t'
      ? line.split('\t')
      : parseCSVLine(line);
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || '';
    });

    try {
      // Map backtesting columns → internal trade object
      // "position" serves as both strategy and position_type
      const trade = {
        date: row.date,
        nifty_value: parseFloat(row.nifty_at_entry) || 0,
        strategy: row.position,           // used for strategy breakdown
        position_type: row.position,      // used in trade log
        entry_reason: row.entry_reason,
        entry_time: row.entry_time,
        entry_premium: parseFloat(row.entry_price) || 0,
        exit_time: row.exit_time,
        exit_premium: parseFloat(row.exit_price) || 0,
        exit_reason: row.exit_reason,
        pnl_pts: parseFloat(row.pnl_pts) || 0,
        pnl: parseFloat(row.pnl_inr) || 0,  // pnl_inr is the primary P&L
        trade_duration: row.trade_duration || '',
        // Pivot levels (optional but expected)
        pivot: row.pivot ? parseFloat(row.pivot) : null,
        r1: row.r1 ? parseFloat(row.r1) : null,
        r2: row.r2 ? parseFloat(row.r2) : null,
        s1: row.s1 ? parseFloat(row.s1) : null,
        s2: row.s2 ? parseFloat(row.s2) : null,
      };

      if (!trade.date || !trade.position_type) continue;
      trades.push(trade);
    } catch (e) {
      console.warn(`Skipping row ${i + 1}: ${e.message}`);
    }
  }

  if (trades.length === 0) {
    throw new Error('No valid trades found in CSV');
  }

  // Sort by date then entry_time
  trades.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return (a.entry_time || '').localeCompare(b.entry_time || '');
  });

  return trades;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}


// ─── CORE KPIs ───────────────────────────────────────────────────────────────

export function calculateKPIs(trades) {
  if (!trades || trades.length === 0) {
    return {
      totalPnL: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0,
      breakEvenTrades: 0, winRate: 0, profitFactor: 0, expectancy: 0,
      avgWin: 0, avgLoss: 0, largestWin: 0, largestLoss: 0,
      riskRewardRatio: 0,
    };
  }

  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl < 0);
  const breakEvens = trades.filter(t => t.pnl === 0);

  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalWins = winners.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0));

  const winRate = (winners.length / trades.length) * 100;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? Infinity : 0);

  const avgWin = winners.length > 0 ? totalWins / winners.length : 0;
  const avgLoss = losers.length > 0 ? totalLosses / losers.length : 0;

  const largestWin = winners.length > 0 ? Math.max(...winners.map(t => t.pnl)) : 0;
  const largestLoss = losers.length > 0 ? Math.min(...losers.map(t => t.pnl)) : 0;

  // Expectancy = (Win% × AvgWin) − (Loss% × AvgLoss)
  const winPct = winners.length / trades.length;
  const lossPct = losers.length / trades.length;
  const expectancy = (winPct * avgWin) - (lossPct * avgLoss);

  // Risk-Reward Ratio = AvgWin / AvgLoss
  const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0);

  return {
    totalPnL: round(totalPnL),
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    breakEvenTrades: breakEvens.length,
    winRate: round(winRate),
    profitFactor: round(profitFactor),
    expectancy: round(expectancy),
    avgWin: round(avgWin),
    avgLoss: round(avgLoss),
    largestWin: round(largestWin),
    largestLoss: round(largestLoss),
    riskRewardRatio: round(riskRewardRatio),
  };
}


// ─── EQUITY CURVE ────────────────────────────────────────────────────────────

export function calculateEquityCurve(trades) {
  if (!trades || trades.length === 0) return { dates: [], cumulative: [], daily: [] };

  // Group trades by date → daily P&L
  const dailyMap = {};
  trades.forEach(t => {
    dailyMap[t.date] = (dailyMap[t.date] || 0) + t.pnl;
  });

  const sortedDates = Object.keys(dailyMap).sort();
  const dates = [];
  const daily = [];
  const cumulative = [];
  let runningTotal = 0;

  sortedDates.forEach(date => {
    const dayPnL = round(dailyMap[date]);
    runningTotal += dayPnL;
    dates.push(date);
    daily.push(dayPnL);
    cumulative.push(round(runningTotal));
  });

  return { dates, cumulative, daily };
}


// ─── DRAWDOWN ANALYSIS ──────────────────────────────────────────────────────

export function calculateDrawdown(trades) {
  const equityCurve = calculateEquityCurve(trades);
  if (equityCurve.cumulative.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPercent: 0, drawdownSeries: [], currentDrawdown: 0 };
  }

  let peak = 0;
  let maxDrawdown = 0;
  const drawdownSeries = [];

  equityCurve.cumulative.forEach((equity, idx) => {
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdown) maxDrawdown = dd;
    drawdownSeries.push({
      date: equityCurve.dates[idx],
      drawdown: -round(dd),  // Negative for display (underwater)
    });
  });

  const lastEquity = equityCurve.cumulative[equityCurve.cumulative.length - 1];
  const currentDD = peak - lastEquity;

  return {
    maxDrawdown: round(maxDrawdown),
    maxDrawdownPercent: peak > 0 ? round((maxDrawdown / peak) * 100) : 0,
    drawdownSeries,
    currentDrawdown: round(currentDD),
  };
}


// ─── STREAK ANALYSIS ─────────────────────────────────────────────────────────

export function calculateStreaks(trades) {
  if (!trades || trades.length === 0) {
    return { maxWinStreak: 0, maxLossStreak: 0, currentStreak: 0, currentStreakType: 'none' };
  }

  let maxWin = 0, maxLoss = 0;
  let currentWin = 0, currentLoss = 0;

  trades.forEach(t => {
    if (t.pnl > 0) {
      currentWin++;
      currentLoss = 0;
      if (currentWin > maxWin) maxWin = currentWin;
    } else if (t.pnl < 0) {
      currentLoss++;
      currentWin = 0;
      if (currentLoss > maxLoss) maxLoss = currentLoss;
    } else {
      // break-even doesn't break streaks
    }
  });

  let currentStreakType = 'none';
  let currentStreak = 0;

  // Walk backwards to find current streak
  for (let i = trades.length - 1; i >= 0; i--) {
    if (i === trades.length - 1) {
      if (trades[i].pnl > 0) { currentStreakType = 'win'; currentStreak = 1; }
      else if (trades[i].pnl < 0) { currentStreakType = 'loss'; currentStreak = 1; }
      else { currentStreakType = 'breakeven'; currentStreak = 1; }
    } else {
      if (currentStreakType === 'win' && trades[i].pnl > 0) currentStreak++;
      else if (currentStreakType === 'loss' && trades[i].pnl < 0) currentStreak++;
      else break;
    }
  }

  return {
    maxWinStreak: maxWin,
    maxLossStreak: maxLoss,
    currentStreak,
    currentStreakType,
  };
}


// ─── SHARPE RATIO ────────────────────────────────────────────────────────────

export function calculateSharpeRatio(trades, riskFreeRate = 0.065) {
  // Using daily P&L, annualized to 252 trading days
  const equityCurve = calculateEquityCurve(trades);
  if (equityCurve.daily.length < 2) return 0;

  const dailyPnLs = equityCurve.daily;
  const mean = dailyPnLs.reduce((s, v) => s + v, 0) / dailyPnLs.length;
  const variance = dailyPnLs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (dailyPnLs.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Daily risk-free = annual / 252
  const dailyRf = riskFreeRate / 252;
  const dailySharpe = (mean - dailyRf) / stdDev;
  const annualizedSharpe = dailySharpe * Math.sqrt(252);

  return round(annualizedSharpe);
}


// ─── HOURLY ANALYSIS (Intraday-specific) ─────────────────────────────────────

export function calculateHourlyAnalysis(trades) {
  // Indian market hours: 9:15 AM to 3:30 PM
  const hourlyBuckets = {};
  const hours = ['09', '10', '11', '12', '13', '14', '15'];

  hours.forEach(h => {
    hourlyBuckets[h] = { hour: `${h}:00`, trades: 0, pnl: 0, wins: 0, losses: 0 };
  });

  trades.forEach(t => {
    const hour = t.entry_time?.substring(0, 2);
    if (hour && hourlyBuckets[hour]) {
      hourlyBuckets[hour].trades++;
      hourlyBuckets[hour].pnl += t.pnl;
      if (t.pnl > 0) hourlyBuckets[hour].wins++;
      else if (t.pnl < 0) hourlyBuckets[hour].losses++;
    }
  });

  return hours.map(h => ({
    ...hourlyBuckets[h],
    pnl: round(hourlyBuckets[h].pnl),
    winRate: hourlyBuckets[h].trades > 0
      ? round((hourlyBuckets[h].wins / hourlyBuckets[h].trades) * 100)
      : 0,
    avgPnl: hourlyBuckets[h].trades > 0
      ? round(hourlyBuckets[h].pnl / hourlyBuckets[h].trades)
      : 0,
  }));
}


// ─── DAY-OF-WEEK ANALYSIS ────────────────────────────────────────────────────

export function calculateDayOfWeekAnalysis(trades) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // Trading days are Mon-Fri
  const tradingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const dayBuckets = {};
  tradingDays.forEach(d => {
    dayBuckets[d] = { day: d, trades: 0, pnl: 0, wins: 0, losses: 0 };
  });

  trades.forEach(t => {
    try {
      const dateObj = new Date(t.date);
      const dayName = dayNames[dateObj.getDay()];
      if (dayBuckets[dayName]) {
        dayBuckets[dayName].trades++;
        dayBuckets[dayName].pnl += t.pnl;
        if (t.pnl > 0) dayBuckets[dayName].wins++;
        else if (t.pnl < 0) dayBuckets[dayName].losses++;
      }
    } catch (e) { /* skip */ }
  });

  return tradingDays.map(d => ({
    ...dayBuckets[d],
    pnl: round(dayBuckets[d].pnl),
    winRate: dayBuckets[d].trades > 0
      ? round((dayBuckets[d].wins / dayBuckets[d].trades) * 100)
      : 0,
    avgPnl: dayBuckets[d].trades > 0
      ? round(dayBuckets[d].pnl / dayBuckets[d].trades)
      : 0,
  }));
}


// ─── TRADE DURATION ANALYSIS ─────────────────────────────────────────────────

export function calculateDurationAnalysis(trades) {
  return trades.map(t => {
    // Use pre-calculated trade_duration if available, else compute from times
    let duration = 0;
    if (t.trade_duration) {
      // Parse formats like "1:30:00" or "45" (minutes)
      const parts = String(t.trade_duration).split(':');
      if (parts.length >= 2) {
        duration = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      } else {
        duration = parseInt(t.trade_duration) || 0;
      }
    } else {
      duration = getMinutesBetween(t.entry_time, t.exit_time);
    }
    return {
      date: t.date,
      strategy: t.strategy,
      duration,
      pnl: t.pnl,
    };
  }).filter(t => t.duration > 0);
}

function getMinutesBetween(startTime, endTime) {
  try {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  } catch {
    return 0;
  }
}


// ─── P&L DISTRIBUTION ────────────────────────────────────────────────────────

export function calculatePnLDistribution(trades, bucketCount = 15) {
  if (!trades || trades.length === 0) return [];

  const pnls = trades.map(t => t.pnl);
  const min = Math.min(...pnls);
  const max = Math.max(...pnls);

  if (min === max) return [{ range: `${min}`, count: trades.length, pnl: min }];

  const bucketSize = (max - min) / bucketCount;
  const buckets = [];

  for (let i = 0; i < bucketCount; i++) {
    const low = min + (i * bucketSize);
    const high = low + bucketSize;
    const count = pnls.filter(p => p >= low && (i === bucketCount - 1 ? p <= high : p < high)).length;
    buckets.push({
      range: `${round(low)}`,
      rangeLabel: `₹${round(low)} to ₹${round(high)}`,
      low: round(low),
      high: round(high),
      count,
    });
  }

  return buckets;
}


// ─── STRATEGY COMPARISON ─────────────────────────────────────────────────────

export function calculateStrategyComparison(trades) {
  const strategyMap = {};

  trades.forEach(t => {
    if (!strategyMap[t.strategy]) {
      strategyMap[t.strategy] = [];
    }
    strategyMap[t.strategy].push(t);
  });

  return Object.entries(strategyMap).map(([strategy, stratTrades]) => {
    const kpis = calculateKPIs(stratTrades);
    const streaks = calculateStreaks(stratTrades);
    const drawdown = calculateDrawdown(stratTrades);
    const sharpe = calculateSharpeRatio(stratTrades);
    const equityCurve = calculateEquityCurve(stratTrades);

    return {
      strategy,
      ...kpis,
      maxWinStreak: streaks.maxWinStreak,
      maxLossStreak: streaks.maxLossStreak,
      maxDrawdown: drawdown.maxDrawdown,
      sharpeRatio: sharpe,
      equityCurve,
    };
  }).sort((a, b) => b.totalPnL - a.totalPnL);
}


// ─── EXIT REASON ANALYSIS ────────────────────────────────────────────────────

export function calculateExitReasonAnalysis(trades) {
  const reasonMap = {};

  trades.forEach(t => {
    const reason = t.exit_reason || 'unknown';
    if (!reasonMap[reason]) {
      reasonMap[reason] = { reason, trades: 0, pnl: 0, wins: 0, losses: 0 };
    }
    reasonMap[reason].trades++;
    reasonMap[reason].pnl += t.pnl;
    if (t.pnl > 0) reasonMap[reason].wins++;
    else if (t.pnl < 0) reasonMap[reason].losses++;
  });

  return Object.values(reasonMap).map(r => ({
    ...r,
    pnl: round(r.pnl),
    winRate: r.trades > 0 ? round((r.wins / r.trades) * 100) : 0,
    avgPnl: r.trades > 0 ? round(r.pnl / r.trades) : 0,
  })).sort((a, b) => b.pnl - a.pnl);
}


// ─── ENTRY REASON ANALYSIS ────────────────────────────────────────────────────

export function calculateEntryReasonAnalysis(trades) {
  const reasonMap = {};

  trades.forEach(t => {
    const reason = t.entry_reason || 'unknown';
    if (!reasonMap[reason]) {
      reasonMap[reason] = { reason, trades: 0, pnl: 0, wins: 0, losses: 0 };
    }
    reasonMap[reason].trades++;
    reasonMap[reason].pnl += t.pnl;
    if (t.pnl > 0) reasonMap[reason].wins++;
    else if (t.pnl < 0) reasonMap[reason].losses++;
  });

  return Object.values(reasonMap).map(r => ({
    ...r,
    pnl: round(r.pnl),
    winRate: r.trades > 0 ? round((r.wins / r.trades) * 100) : 0,
    avgPnl: r.trades > 0 ? round(r.pnl / r.trades) : 0,
  })).sort((a, b) => b.pnl - a.pnl);
}


// ─── MONTHLY BREAKDOWN ──────────────────────────────────────────────────────

export function calculateMonthlyBreakdown(trades) {
  const monthlyMap = {};

  trades.forEach(t => {
    const month = t.date.substring(0, 7); // YYYY-MM
    if (!monthlyMap[month]) {
      monthlyMap[month] = { month, trades: 0, pnl: 0, wins: 0, losses: 0 };
    }
    monthlyMap[month].trades++;
    monthlyMap[month].pnl += t.pnl;
    if (t.pnl > 0) monthlyMap[month].wins++;
    else if (t.pnl < 0) monthlyMap[month].losses++;
  });

  return Object.values(monthlyMap)
    .map(m => ({
      ...m,
      pnl: round(m.pnl),
      winRate: m.trades > 0 ? round((m.wins / m.trades) * 100) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}


// ─── FULL ANALYSIS (convenience wrapper) ─────────────────────────────────────

export function runFullAnalysis(trades) {
  return {
    kpis: calculateKPIs(trades),
    equityCurve: calculateEquityCurve(trades),
    drawdown: calculateDrawdown(trades),
    streaks: calculateStreaks(trades),
    sharpeRatio: calculateSharpeRatio(trades),
    hourlyAnalysis: calculateHourlyAnalysis(trades),
    dayOfWeekAnalysis: calculateDayOfWeekAnalysis(trades),
    durationAnalysis: calculateDurationAnalysis(trades),
    pnlDistribution: calculatePnLDistribution(trades),
    strategyComparison: calculateStrategyComparison(trades),
    exitReasonAnalysis: calculateExitReasonAnalysis(trades),
    entryReasonAnalysis: calculateEntryReasonAnalysis(trades),
    monthlyBreakdown: calculateMonthlyBreakdown(trades),
    tradeCount: trades.length,
    dateRange: trades.length > 0
      ? { from: trades[0].date, to: trades[trades.length - 1].date }
      : { from: '', to: '' },
    strategies: [...new Set(trades.map(t => t.strategy))].sort(),
  };
}


// ─── HELPERS ─────────────────────────────────────────────────────────────────

function round(val, decimals = 2) {
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
