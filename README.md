# QuantumTrader Dashboard

Trading bot performance dashboard for monitoring NIFTY trading strategies in real-time.

```
⚛️ React + FastAPI + DynamoDB + AWS
```

---

## 🚀 Features

- **Real-time Dashboard** - Monitor KPIs (PnL, win rate, profit factor, sharpe ratio)
- **Trade History** - View all trades with advanced filtering by date, strategy, position type
- **Strategy Analytics** - Compare performance across reversal and straddle strategies
- **Automatic S3 Sync** - Lambda-triggered sync when CSV uploaded by trading bot
- **Manual CSV Upload** - Import historical trades manually
- **Dark Mode** - Beautiful dark-themed UI out of the box
- **JWT Authentication** - Single-user authentication with JWT tokens
- **Responsive Design** - Works on desktop and mobile

---

## 📋 Quick Start (Local Development)

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone & Setup

```bash
cd QuantumTraderDashboard

# Create backend env
cp backend/.env.local backend/.env

# Create frontend env
cp frontend/.env.local frontend/.env
```

### 2. Start with Docker Compose

```bash
docker-compose up -d
```

**Services:**

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- DynamoDB Local: `http://localhost:8001`
- API Docs: `http://localhost:8000/api/docs`

### 3. Login

**Email:** `trader@quantumtrader.com`
**Password:** `admin@123`

### 4. Stop Services

```bash
docker-compose down
```

---

## 🏗️ Architecture

```
┌─────────────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  React Frontend         │────►│  FastAPI Backend │────►│  DynamoDB        │
│  (Dark Mode, SPA)       │     │  (Python)        │     │  (NoSQL DB)      │
└─────────────────────────┘     └──────────────────┘     └──────────────────┘
      (S3 + CloudFront)         (ECS Fargate)                    (AWS)
          ▲                             │                         ▲
          │                             │                         │
          │                 ┌─CS V Upload endpoint                │
          │                 │  (manual or Lambda)                 │
          │                 │                                     │
          └─────────────────┴─────────────────────────────────────┘
                  (Local/S3 Bucket)
```

---

## 📊 Project Structure

```
QuantumTraderDashboard/
├── backend/                      # FastAPI application
│   ├── app/
│   │   ├── api/routes/          # API endpoints
│   │   ├── services/            # Business logic
│   │   ├── utils/               # Utilities
│   │   ├── main.py              # FastAPI app
│   │   ├── database.py          # DynamoDB setup
│   │   ├── config.py            # Configuration
│   │   └── models.py            # Pydantic schemas
│   ├── lambda/                  # AWS Lambda function
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.local
│
├── frontend/                     # React SPA
│   ├── src/
│   │   ├── pages/               # Dashboard, Trades, Strategy, Upload, Settings
│   │   ├── components/          # Layout, Header, Sidebar, KPICard, etc.
│   │   ├── hooks/               # useAuth, useTrades, useDashboard
│   │   ├── services/            # Axios API client
│   │   ├── styles/              # CSS (dark mode)
│   │   ├── App.jsx              # Main routing
│   │   └── index.js             # Entry point
│   ├── package.json
│   ├── Dockerfile
│   ├── .env.local
│   └── public/
│
├── docker-compose.yml           # Local dev setup
├── README.md                     # This file
└── .gitignore
```

---

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/login` - Login (email + password)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/verify` - Verify token

### Trades

- `GET /api/trades` - List all trades (paginated)
- `GET /api/trades/date/{date}` - Trades by specific date
- `GET /api/trades/strategy/{strategy}` - Trades by strategy
- `POST /api/trades/filter` - Advanced filtering
- `POST /api/trades` - Create new trade
- `DELETE /api/trades/{trade_id}` - Delete trade

### Dashboard

- `GET /api/dashboard/kpis` - KPI metrics
- `GET /api/dashboard/chart-data` - Equity curve data
- `GET /api/dashboard/monthly-pnl` - Monthly breakdown
- `GET /api/dashboard/summary` - Dashboard summary

### Strategy

- `GET /api/strategy` - List strategies
- `GET /api/strategy/{strategy}/performance` - Strategy metrics
- `GET /api/strategy/all/performance` - All strategies
- `GET /api/strategy/comparison` - Side-by-side comparison

### Upload & Sync

- `POST /api/upload/csv` - Upload CSV file
- `POST /api/s3/auto-sync` - S3 auto-sync (Lambda trigger)
- `GET /api/s3/today` - Fetch today's trades from S3

---

## 📦 CSV Format

**Expected CSV columns** (`trades_YYYY-MM-DD.csv`):

```csv
date,nifty_value,strategy,entry_reason,option_strike,sold_option,position_type,entry_time,entry_premium,exit_time,exit_premium,exit_reason,quantity,pnl[,ce_symbol,pe_symbol,straddle_vwap]
```

**Example:**

```csv
2026-03-10,22550.0,reversal_pivot_supertrend,ST_FLIP_BULLISH,22550,NIFTY17MAR2622550PE,short_put,10:15:00,85.5,13:45:00,45.0,pivot_support_broken,1,40.5
```

---

## 🚀 Production Deployment (AWS)

### Prerequisites

- AWS account with programmatic access
- AWS CLI configured
- S3 bucket `shri-trading-logs` created

### Step 1: Build Docker Images

```bash
# Backend
docker build -t quantumtrader-backend:latest ./backend
docker tag quantumtrader-backend:latest YOUR_AWS_ACCOUNT.dkr.ecr.ap-south-1.amazonaws.com/quantumtrader-backend:latest
docker push YOUR_AWS_ACCOUNT.dkr.ecr.ap-south-1.amazonaws.com/quantumtrader-backend:latest

# Frontend
docker build -t quantumtrader-frontend:latest ./frontend
docker tag quantumtrader-frontend:latest YOUR_AWS_ACCOUNT.dkr.ecr.ap-south-1.amazonaws.com/quantumtrader-frontend:latest
docker push YOUR_AWS_ACCOUNT.dkr.ecr.ap-south-1.amazonaws.com/quantumtrader-frontend:latest
```

### Step 2: Deploy CloudFormation Stack

```bash
aws cloudformation create-stack \
  --stack-name quantumtrader-dashboard \
  --template-body file://infra/cloudformation/dashboard-dynamodb.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=production \
  --region ap-south-1
```

### Step 3: Deploy Lambda Function

```bash
# Package Lambda function
cd backend/lambda
zip -r ../lambda_function.zip .

# Upload to Lambda
aws lambda create-function \
  --function-name quantumtrader-s3-sync \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler s3_trigger_lambda.lambda_handler \
  --zip-file fileb://../lambda_function.zip \
  --environment Variables={DASHBOARD_API_URL=https://api.quantumtrader.com,DASHBOARD_API_KEY=YOUR_API_KEY} \
  --region ap-south-1
```

### Step 4: Configure S3 Event Notification

```bash
aws s3api put-bucket-notification-configuration \
  --bucket shri-trading-logs \
  --notification-configuration file://s3-lambda-trigger.json \
  --region ap-south-1
```

---

## 🔐 Environment Variables

### Backend (.env)

```
IS_LOCAL=false
DEBUG=false
DYNAMODB_TABLE=QuantumTrader-Trades
AWS_DEFAULT_REGION=ap-south-1
JWT_SECRET=your-super-secret-key
USER_EMAIL=trader@quantumtrader.com
USER_PASSWORD=secure-password
S3_BUCKET=shri-trading-logs
```

### Frontend (.env)

```
REACT_APP_API_URL=https://api.quantumtrader.com
```

---

## 📈 Architecture Decisions

### Why DynamoDB?

- **Cost**: Pay-per-request pricing (free tier covers usage for personal use)
- **Scalability**: Auto-scales to handle traffic spikes
- **Simplicity**: No database management overhead
- **Perfect for**: Low-volume, periodic data access

### Why Fastapi + React?

- **Performance**: Fast async processing
- **Modern Stack**: TypeScript + async/await
- **Real-time**: WebSockets support (future)
- **Testing**: Excellent testing frameworks
- **Deployment**: Easy containerization with Docker

### Why Lambda Auto-Sync?

- **Event-driven**: Triggers automatically when CSV uploaded
- **Serverless**: No infrastructure to manage
- **Reliable**: Automatic retries and error handling
- **Cost-effective**: Pay only for execution time

---

## 🧪 Testing

### Backend Tests

```bash
cd backend
python -m pytest tests/
```

### Frontend Tests

```bash
cd frontend
npm test
```

### Integration Testing

```bash
# Local smoke tests after starting docker-compose
npm run test:e2e
```

---

## 📊 KPIs Displayed

- **Total PnL** - Sum of all trade profits/losses
- **Win Rate** - Percentage of profitable trades
- **Profit Factor** - Ratio of total wins to total losses
- **Sharpe Ratio** - Risk-adjusted return
- **Average Win/Loss** - Mean profit/loss per trade
- **Largest Win/Loss** - Max single-trade win/loss
- **Equity Curve** - Cumulative PnL over time

---

## 🔗 Trading Bot Integration

### How S3 Sync Works

```
1. Trading Bot (ECS) runs daily 09:30-15:30
2. At end of day, uploads trades_YYYY-MM-DD.csv to S3
3. S3 triggers Lambda event
4. Lambda calls dashboard `/api/s3/auto-sync` endpoint
5. Dashboard fetches CSV from S3
6. Parses trades and upserts to DynamoDB
7. Frontend auto-refreshes to show new trades
```

### CSV Upload Requirements

- File format: `trades_YYYY-MM-DD.csv`
- Location: `s3://shri-trading-logs/paper-trading/{year}/{month}/{filename}`
- Columns: Must include all 14 required columns
- Delimiter: Comma (,)

---

## 🐛 Troubleshooting

### Issue: "Connection refused" when starting

**Solution:**

```bash
docker-compose down
docker-compose up -d --build
```

### Issue: DynamoDB table not found

**Solution:**
The table is created automatically on first backend startup. Wait 30 seconds and refresh.

### Issue: CSV upload fails

**Solution:**
Check CSV format matches expected schema. Run validation:

```bash
python -c "from app.services.csv_parser import CSVParserService; print(CSVParserService.EXPECTED_COLUMNS)"
```

### Issue: CORS errors in frontend

**Solution:**
Ensure `REACT_APP_API_URL` environment variable matches backend URL.

---

## 📝 License

Proprietary. Use for authorized trading analysis only.

---

## 📞 Support

Contact: [Your Email]

---

**Last Updated:** March 10, 2026
**Version:** 1.0.0
**Status:** Production Ready ✅

added for testing
