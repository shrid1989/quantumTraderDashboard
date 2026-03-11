# QuantumTrader Dashboard - Project Context

## Project Overview

A real-time dashboard for monitoring NIFTY paper trading strategies with FastAPI backend and React frontend. Tracks trade metrics, P&L, and provides detailed trade history with filtering and analysis.

## Current Status ✅

- **Backend**: Fully functional with DynamoDB integration
- **Frontend**: Trades page fully redesigned with compact collapsible details
- **Database**: DynamoDB with GSI for date-based queries
- **Docker**: Local development environment setup complete
- **Authentication**: JWT token-based single-user auth via Context API

## Architecture

### Backend Stack

- **Framework**: FastAPI (async)
- **Database**: AWS DynamoDB (Local)
- **Authentication**: JWT tokens
- **CSV Upload**: Manual trade uploads + Lambda automation (planned)

### Frontend Stack

- **Framework**: React 18
- **State Management**: React Hooks + Context API
- **Styling**: CSS with dark mode variables
- **Tables**: Custom responsive tables with sorting/filtering

## Key Files & Their Purpose

### Backend Files

| File                                    | Purpose                            |
| --------------------------------------- | ---------------------------------- |
| `backend/app/main.py`                   | FastAPI app initialization, routes |
| `backend/app/database.py`               | DynamoDB table management, queries |
| `backend/app/services/trade_service.py` | Trade business logic, CSV parsing  |
| `backend/app/models/trade.py`           | Pydantic models for trade data     |
| `backend/requirements.txt`              | Python dependencies                |
| `docker-compose.yml`                    | Local DynamoDB + app services      |

### Frontend Files

| File                             | Purpose                                              |
| -------------------------------- | ---------------------------------------------------- |
| `frontend/src/pages/Trades.jsx`  | Main trades table with sorting, filtering, expansion |
| `frontend/src/styles/trades.css` | Trades page styling (compact grid layout)            |
| `frontend/src/styles/global.css` | Global CSS variables, dark mode theme                |
| `frontend/src/hooks/useAuth.js`  | Authentication context hook                          |
| `frontend/src/services/api.js`   | API client for backend calls                         |
| `frontend/src/index.js`          | React app entry point with AuthProvider              |

## Recent Changes (Session 2)

### 1. Made Collapsible Detail Panel Compact

**File**: `frontend/src/styles/trades.css`

- Reduced padding: 1rem → 0.6rem (content), 0.8rem → 0.5rem (items)
- Tighter spacing: 1rem → 0.6rem (grid gap), 0.4rem → 0.3rem (label-value gap)
- Smaller fonts: 0.75rem → 0.7rem (labels), 0.9rem → 0.8rem (values)
- More compact columns: minmax(200px, 1fr) → minmax(140px, 1fr)
- Refined borders: 3px → 2px, radius 6px → 4px

### 2. Expanded Detail Panel with All Fields

**File**: `frontend/src/pages/Trades.jsx` (lines 396-479)

- Added all available trade details to collapsible panel
- Displays conditionally (only if data exists):
  - Option Strike, CE/PE Symbols
  - Position Type, Straddle VWAP
  - Support Levels: Pivot, S1, S2
  - Resistance Levels: R1, R2
  - Entry/Exit Reasons, Sold Option

## Trades Page Features

### Main Table Columns (Single Row)

1. **Expand** - Chevron (▶) to expand details
2. **Date** - Trade date (sortable)
3. **NIFTY** - Index value (sortable)
4. **Strategy** - Trading strategy name (sortable, filterable)
5. **Entry Reason** - Why trade was entered
6. **Sold Option** - Option symbol sold
7. **Position** - short_put/short_straddle/etc
8. **Entry → Exit Time** - Color-coded time range (green entry, red exit)
9. **Entry / Exit Premium** - Color-coded premiums (₹)
10. **Exit Reason** - Why trade was exited
11. **Qty** - Trade quantity
12. **P&L** - Profit/Loss (sortable, color-coded)

### Collapsible Detail Row

Shown when user clicks expand chevron. Displays in compact grid:

- Option Strike, CE/PE Symbols
- Position Type, Straddle VWAP
- Support/Resistance levels (Pivot, S1, S2, R1, R2)
- Entry/Exit Reasons (full text)
- Sold Option details

### Filters & Sorting

- **Date Filters**: All Trades | Last 1 Day | Last 2 Days | Custom Date Range (inline picker)
- **Search**: By date, strategy, reason, option
- **Strategy Filter**: Dropdown with all available strategies
- **Sortable Columns**: Date, NIFTY, Strategy, Entry Premium, P&L

### Statistics Display

- Total Trades count
- Total P&L (green/red)
- Win Rate %
- Results breakdown: Wins ✅ | Losses ❌ | Breakeven ➡️

## CSV Structure

```
date,nifty_value,strategy,entry_reason,option_strike,sold_option,
position_type,entry_time,entry_premium,exit_time,exit_premium,
exit_reason,quantity,pnl,pivot,s1,s2,r1,r2
```

### Example Row

```
2026-03-10,22550.0,reversal_pivot_supertrend,ST_FLIP_BULLISH,22550,
NIFTY17MAR2622550PE,short_put,10:15:00,85.5,13:45:00,45.0,
pivot_support_broken,1,40.5,,,,,
```

## DynamoDB Setup

### Tables & Indexes

**Trades Table Attributes:**

- `trade_id` (Primary Key): UUID
- `timestamp` (Sort Key): ISO datetime
- `date` (GSI Key): YYYY-MM-DD format
- `pnl` (GSI Sort): For range queries
- All numeric fields: Decimal type (NOT float)

**Global Secondary Indexes:**

- `date-pnl-index`: For querying trades by date

### Key Fixes Applied

1. **Reserved Keywords**: Use ExpressionAttributeNames for "date"

   ```python
   KeyConditionExpression="#d = :date",
   ExpressionAttributeNames={"#d": "date"}
   ```

2. **Float Type Error**: Convert all numerics to Decimal
   ```python
   "entry_premium": Decimal(str(trade.entry_premium))
   ```

## Color Coding Scheme

| Element       | Color           | Meaning        |
| ------------- | --------------- | -------------- |
| Entry Time    | Green (#4CAF50) | Position entry |
| Exit Time     | Red (#F44336)   | Position exit  |
| Entry Premium | Green           | Cost paid      |
| Exit Premium  | Red             | Cost received  |
| P&L Positive  | Green           | Profit         |
| P&L Negative  | Red             | Loss           |
| P&L Neutral   | Gray            | Breakeven      |

## CSS Dark Mode Variables

```css
--bg-primary: #1a1a1a --bg-secondary: #2a2a2a --text-primary: #e0e0e0
  --text-secondary: #999999 --border-color: #333333 --accent-primary: #00968d
  (teal) --accent-green: #4caf50 --accent-red: #f44336;
```

## Setup & Running

### Prerequisites

- Docker & Docker Compose
- Node.js 16+ (frontend)
- Python 3.9+ (backend)

### Start Development

```bash
# Terminal 1: Start services
docker-compose up

# Terminal 2: Backend
cd backend && python -m uvicorn app.main:app --reload

# Terminal 3: Frontend
cd frontend && npm start
```

### Access

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **DynamoDB Admin**: http://localhost:8001

## Pending Tasks

### Short Term

- [ ] Test end-to-end workflow with sample trades
- [ ] Verify all collapsible details display correctly
- [ ] Test responsive design on mobile

### Medium Term

- [ ] Set up S3 bucket for automated CSV uploads
- [ ] Create Lambda trigger for daily CSV sync
- [ ] Add trading performance analytics dashboard
- [ ] Implement real-time trade updates (WebSocket)

### Long Term

- [ ] Deploy to AWS (Elastic Beanstalk/EC2/Lambda)
- [ ] Set up CI/CD pipeline
- [ ] Add user preferences/settings page
- [ ] Implement trade alert notifications

## Known Issues & Workarounds

### None Currently

All major issues from Session 1 have been resolved:

- ✅ Docker-compose health checks removed
- ✅ DynamoDB reserved keyword handling fixed
- ✅ Float type conversion handled with Decimal
- ✅ AuthProvider context wrapper added
- ✅ CSS syntax errors fixed
- ✅ Collapsible details expanded with all fields

## Testing Notes

### Manual CSV Upload

1. Navigate to http://localhost:3000/trades
2. Upload trades_YYYY-MM-DD.csv file
3. Verify trades appear in table
4. Click expand chevron to see all details
5. Test filters: date, search, strategy

### Date Filtering

- "All Trades" - shows all uploaded trades
- "Last 1 Day" - shows today only
- "Last 2 Days" - shows last 2 days
- "Custom" - inline date picker for custom range

### Collapsible Details

- Click ▶ to expand, details show in compact grid
- All fields display conditionally (empty = hidden)
- Click again to collapse

## Important Notes

1. **DynamoDB Decimal Type**: Always convert floats to Decimal when storing
2. **Reserved Keywords**: "date" is reserved in DynamoDB, use ExpressionAttributeNames
3. **JWT Tokens**: Single user auth via context, stored in localStorage
4. **Responsive Design**: Breakpoints at 1400px, 1024px, 768px, 480px
5. **CSV Columns**: All 19 columns should be present (some can be empty)

## Contact & Support

For issues or questions, refer to the issue tracker or check the conversation logs.
