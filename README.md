# QuantumTrader Dashboard

Personal NIFTY trading bot performance dashboard — monitor strategies, analyze trades, and backtest with professional-grade analytics.

```
⚛️ React + FastAPI + Supabase PostgreSQL
```

**Cost: $0/month** (all free tiers)

---

## 🚀 Features

- **Real-time Dashboard** — KPIs (P&L, win rate, profit factor), equity curve, monthly breakdown
- **Trade History** — View all trades with filtering by date, strategy, position type
- **Strategy Analytics** — Compare performance across strategies with Sharpe ratio
- **Day Wise Analysis** — Day-by-day trade breakdown
- **🧪 Backtesting Analytics** — Upload backtest CSVs for pro-level analysis:
  - Drawdown curve, Sharpe ratio, expectancy, risk-reward ratio
  - Hour-of-day & day-of-week analysis (intraday-specific)
  - Trade duration vs P&L scatter plot
  - P&L distribution histogram
  - Strategy comparison with overlaid equity curves
  - Sortable/filterable trade log
- **CSV Upload** — Import trades manually
- **S3 → Lambda → Supabase** — Automatic sync when trading bot uploads CSV
- **Dark/Light Mode** — Toggle theme
- **JWT Authentication** — Single-user auth
- **Responsive** — Works on desktop and mobile

---

## 📋 Quick Start (Local Development)

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account (free at [supabase.com](https://supabase.com))

### 1. Create Supabase Project

1. Go to **supabase.com** → Create account → New project
2. Go to **SQL Editor** → Paste and run [`supabase/migrations/001_create_trades.sql`](supabase/migrations/001_create_trades.sql)

### 2. Configure Environment

```bash
# Copy and fill in your Supabase credentials
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJxxxxx...
IS_LOCAL=true
JWT_SECRET=change-this-in-production
USER_EMAIL=trader@quantumtrader.com
USER_PASSWORD=your-secure-password
S3_BUCKET=shri-trading-logs
```

### 3. Run Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Visit http://localhost:8000/health → `{"status":"healthy","database":"connected"}`

### 4. Run Frontend

```bash
cd frontend
npm install   # first time only
npm start
```

Visit http://localhost:3000

### 5. Login

- **Email:** `trader@quantumtrader.com`
- **Password:** (set in `backend/.env` as `USER_PASSWORD`)

---

## 🏗️ Architecture

```
┌─────────────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  React Frontend         │────►│  FastAPI Backend  │────►│  Supabase        │
│  (Vercel, $0)           │     │  (Render, $0)     │     │  PostgreSQL ($0) │
└─────────────────────────┘     └──────────────────┘     └──────────────────┘
                                                                   ▲
                         ┌──────────────┐                          │
                         │  S3 + Lambda │──── direct write ────────┘
                         │  (CSV sync)  │
                         └──────────────┘
```

**Backtesting** is fully client-side — no backend calls, no DB writes. Upload CSV → analyze in-browser → discard.

---

## 📊 Project Structure

```
QuantumTraderDashboard/
├── backend/
│   ├── app/
│   │   ├── api/routes/           # auth, dashboard, strategy, trades, upload
│   │   ├── services/             # csv_parser, metrics_service, trade_service
│   │   ├── utils/                # exceptions, logger
│   │   ├── main.py               # FastAPI app entry
│   │   ├── database.py           # Supabase client
│   │   ├── config.py             # Environment config
│   │   └── models.py             # Pydantic schemas
│   ├── lambda/
│   │   ├── s3_trigger_lambda.py  # S3 → Supabase direct write
│   │   └── requirements.txt
│   ├── .env                      # Supabase credentials (not committed)
│   ├── .env.example              # Safe template
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── pages/                # Dashboard, Trades, Strategy, Upload,
│   │   │                         #   Settings, DayWise, Backtesting
│   │   ├── components/           # Layout
│   │   ├── hooks/                # useAuth
│   │   ├── services/
│   │   │   ├── api.js            # Axios API client
│   │   │   └── backtestAnalytics.js  # Client-side analytics engine
│   │   ├── styles/               # CSS (dark mode + backtesting)
│   │   ├── App.jsx               # Main routing
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
│
├── supabase/
│   └── migrations/
│       └── 001_create_trades.sql # PostgreSQL schema
│
├── docker-compose.yml
└── README.md
```

---

## 🔌 API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/login` | POST | Login (returns JWT) |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/verify` | GET | Verify token |
| `/api/trades` | GET | List all trades (paginated) |
| `/api/trades/date/{date}` | GET | Trades by date |
| `/api/trades/strategy/{strategy}` | GET | Trades by strategy |
| `/api/trades/filter` | POST | Advanced filtering |
| `/api/dashboard/kpis` | GET | KPI metrics |
| `/api/dashboard/chart-data` | GET | Equity curve data |
| `/api/dashboard/monthly-pnl` | GET | Monthly breakdown |
| `/api/strategy` | GET | List strategies |
| `/api/strategy/{strategy}/performance` | GET | Strategy metrics |
| `/api/strategy/all/performance` | GET | All strategies |
| `/api/upload/csv` | POST | Upload CSV file |
| `/health` | GET | Health check |

> **Note:** Backtesting has no API endpoints — it's fully processed in the browser.

---

## 📦 CSV Format

**Required columns** (`trades_YYYY-MM-DD.csv`):

```csv
date,nifty_value,strategy,entry_reason,option_strike,sold_option,position_type,entry_time,entry_premium,exit_time,exit_premium,exit_reason,quantity,pnl
```

**Optional columns:** `ce_symbol`, `pe_symbol`, `straddle_vwap`, `pivot`, `s1`, `s2`, `r1`, `r2`

**Example:**
```csv
2026-03-01,22350.0,reversal_pivot_supertrend,ST_FLIP_BULLISH,22350,NIFTY06MAR2622350PE,short_put,09:45:00,75.0,12:00:00,38.0,target_hit,1,37.0
```

Same format works for **paper trading uploads**. Backtesting uses a different format (see below).

### Backtesting CSV Format

```csv
date,position,nifty_at_entry,entry_reason,entry_time,entry_price,exit_time,exit_price,exit_reason,pnl_pts,pnl_inr,trade_duration,pivot,r1,r2,s1,s2
```

> **Note:** Tab-separated (TSV) files are also supported for backtesting.

---

## 🚀 Production Deployment

| Service | What | Cost |
|---|---|---|
| **Vercel** | Frontend (React) | $0 |
| **Render** | Backend (FastAPI) | $0 (sleeps after 15 min) |
| **Supabase** | Database (PostgreSQL) | $0 |
| **S3 + Lambda** | CSV auto-sync | ~$0 |

### Deploy Frontend (Vercel)

1. Go to **vercel.com** → Import GitHub repo
2. Set **Root Directory**: `frontend`
3. Add env var: `REACT_APP_API_URL = https://your-backend.onrender.com`
4. Deploy

### Deploy Backend (Render)

1. Go to **render.com** → New Web Service → Connect repo
2. Settings:
   - **Root Directory:** `backend`
   - **Build:** `pip install -r requirements.txt`
   - **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add environment variables: `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`, `FRONTEND_URL`, `USER_EMAIL`, `USER_PASSWORD`

### Lambda (Optional)

Set `SUPABASE_URL` and `SUPABASE_KEY` as Lambda environment variables. Upload `backend/lambda/s3_trigger_lambda.py` as deployment package.

---

## 🔐 Environment Variables

### Backend (.env)

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-service-role-key
IS_LOCAL=true
JWT_SECRET=change-this-in-production
USER_EMAIL=trader@quantumtrader.com
USER_PASSWORD=your-secure-password
S3_BUCKET=shri-trading-logs
```

### Frontend (.env)

```
REACT_APP_API_URL=http://localhost:8000
```

> **Never commit `.env`** — it's in `.gitignore`. Use `.env.example` as template.

---

## 🧪 Backtesting Analytics

The Backtesting tab provides professional-grade strategy analysis:

| Metric | Description |
|---|---|
| Net P&L | Total profit/loss across all trades |
| Win Rate | % of profitable trades |
| Profit Factor | Gross profit / Gross loss |
| Expectancy | Expected ₹ per trade (Win% × AvgWin − Loss% × AvgLoss) |
| Max Drawdown | Largest peak-to-trough decline |
| Sharpe Ratio | Risk-adjusted return (annualized, 252 days) |
| Risk-Reward | Average win / Average loss |
| Streaks | Max consecutive wins/losses |

**Charts:** Equity curve, drawdown (underwater), daily P&L bars, P&L distribution histogram, monthly breakdown

**Time Analysis:** P&L by entry hour, P&L by day-of-week, trade duration vs P&L scatter

**Strategy Comparison:** Side-by-side table + overlaid equity curves when CSV has multiple strategies

---

## 🐛 Troubleshooting

### Backend won't start
- Check `.env` has valid `SUPABASE_URL` and `SUPABASE_KEY`
- Test: `python3 -c "from app.database import get_db_client; print('OK')"`

### Can't upload CSV
- Check `trades` table exists in Supabase (run the migration SQL)
- Verify CSV headers match expected columns

### Frontend shows "Network Error"
- Check `REACT_APP_API_URL` is set correctly
- Verify backend: `curl http://localhost:8000/health`
- Check browser console (F12) for CORS errors

### Render backend keeps sleeping
- Use [UptimeRobot](https://uptimerobot.com) (free) to ping `/health` every 5 min
- Or upgrade to Render paid ($7/month) for always-on

---

## 📝 License

Proprietary. Use for authorized trading analysis only.

---

**Last Updated:** March 17, 2026
**Version:** 2.0.0
**Status:** Production Ready ✅ | Backtesting Analytics ✅
