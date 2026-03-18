-- Backtest History Tables
-- Run this in Supabase Dashboard → SQL Editor

-- Sessions table: one row per saved backtest run
CREATE TABLE IF NOT EXISTS backtest_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_name    VARCHAR(200) NOT NULL,
    description     TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    strategy_name   VARCHAR(200) DEFAULT '',
    data_date_from  DATE,
    data_date_to    DATE,
    total_trades    INTEGER DEFAULT 0,
    net_pnl         NUMERIC DEFAULT 0,
    win_rate        NUMERIC DEFAULT 0,
    profit_factor   NUMERIC DEFAULT 0,
    max_drawdown    NUMERIC DEFAULT 0,
    sharpe_ratio    NUMERIC DEFAULT 0,
    expectancy      NUMERIC DEFAULT 0,
    risk_reward     NUMERIC DEFAULT 0,
    max_win_streak  INTEGER DEFAULT 0,
    max_loss_streak INTEGER DEFAULT 0,
    tags            TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Individual trades linked to a session
CREATE TABLE IF NOT EXISTS backtest_trades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES backtest_sessions(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    position        VARCHAR(100),
    nifty_at_entry  NUMERIC,
    entry_reason    VARCHAR(500),
    entry_time      VARCHAR(20),
    entry_price     NUMERIC,
    exit_time       VARCHAR(20),
    exit_price      NUMERIC,
    exit_reason     VARCHAR(500),
    pnl_pts         NUMERIC DEFAULT 0,
    pnl_inr         NUMERIC DEFAULT 0,
    trade_duration  VARCHAR(50),
    pivot           NUMERIC,
    r1              NUMERIC,
    r2              NUMERIC,
    s1              NUMERIC,
    s2              NUMERIC
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bt_sessions_created   ON backtest_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bt_sessions_strategy  ON backtest_sessions (strategy_name);
CREATE INDEX IF NOT EXISTS idx_bt_trades_session     ON backtest_trades (session_id);
CREATE INDEX IF NOT EXISTS idx_bt_trades_date        ON backtest_trades (date);
