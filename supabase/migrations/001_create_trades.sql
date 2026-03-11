-- QuantumTrader Dashboard - PostgreSQL Schema
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS trades (
    trade_id        TEXT PRIMARY KEY,
    date            DATE NOT NULL,
    nifty_value     NUMERIC,
    strategy        VARCHAR(100),
    entry_reason    VARCHAR(500),
    option_strike   INTEGER,
    sold_option     VARCHAR(200),
    position_type   VARCHAR(50),
    entry_time      TIME,
    entry_premium   NUMERIC,
    exit_time       TIME,
    exit_premium    NUMERIC,
    exit_reason     VARCHAR(500),
    quantity        INTEGER DEFAULT 1,
    pnl             NUMERIC,
    ce_symbol       VARCHAR(200),
    pe_symbol       VARCHAR(200),
    straddle_vwap   NUMERIC,
    pivot           NUMERIC,
    s1              NUMERIC,
    s2              NUMERIC,
    r1              NUMERIC,
    r2              NUMERIC,
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_trades_date     ON trades (date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades (strategy);
CREATE INDEX IF NOT EXISTS idx_trades_pnl      ON trades (pnl);
