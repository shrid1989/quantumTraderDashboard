-- Strategy Schedules — On/Off strategy deployment manager
-- Run this in Supabase Dashboard → SQL Editor

-- 1 row per strategy with active_days array
DROP TABLE IF EXISTS strategy_schedules CASCADE;
DROP TABLE IF EXISTS strategy_overrides CASCADE;

CREATE TABLE IF NOT EXISTS strategy_schedules (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    strategy_name   VARCHAR(100) UNIQUE NOT NULL,
    active_days     INTEGER[] DEFAULT '{0,1,2,3,4}',   -- 0=Mon,1=Tue,2=Wed,3=Thu,4=Fri
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Date-specific overrides (separate table)
CREATE TABLE IF NOT EXISTS strategy_overrides (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    strategy_name   VARCHAR(100) NOT NULL,
    specific_date   DATE NOT NULL,
    is_active       BOOLEAN DEFAULT FALSE,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(strategy_name, specific_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schedules_name    ON strategy_schedules (strategy_name);
CREATE INDEX IF NOT EXISTS idx_overrides_date    ON strategy_overrides (specific_date);
CREATE INDEX IF NOT EXISTS idx_overrides_name    ON strategy_overrides (strategy_name);

-- Seed: all 3 strategies active Mon-Fri
INSERT INTO strategy_schedules (strategy_name, active_days) VALUES
    ('straddle_time1',             '{0,1,2,3,4}'),
    ('straddle_time2',             '{0,1,2,3,4}'),
    ('reversal_pivot_supertrend',  '{0,1,2,3,4}')
ON CONFLICT (strategy_name) DO NOTHING;
