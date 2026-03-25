# NIFTY Trading Bot - Project Context & Architecture

This document provides a comprehensive high-level and detailed overview of the NIFTY Trading Bot on AWS ECS. It serves as the definitive reference for understanding how the core systems, data flows, limits, and strategy engines work together so this context can be securely portable to other projects.

---

## 0. Technology Stack & Environment
If integrating this logic into a separate project, the following ecosystem is required for full compatibility:
* **Language**: Python 3.9+ 
* **Broker API**: Zerodha `kiteconnect` (used for all auth, live ticks, and historical quotes).
* **Data Processing**: `pandas` and `numpy` (crucial for executing historical VWAP/Supertrend math cleanly without custom arrays).
* **Cloud & Infrastructure**: Designed for Dockerized containers running on **AWS ECS**.
* **Storage**: **AWS S3** (`boto3`). Since ECS containers are ephemeral, all end-of-day CSV logs and PNG charts are instantly uploaded to S3 at market close (`15:20`).
* **Concurrency**: Native Python `threading`. Essential for running separate decoupled strategy files simultaneously without event loop blocking.
* **Time Tracking**: `pytz` timezone (`Asia/Kolkata`). Required. AWS executes in absolute UTC, and if the system is not hard-coded to IST, end-of-day bounds, option expiry formulas, and opening times will immediately fail.

---

## 1. System Architecture & Entry Point (`main.py`)
The system is designed to be highly resilient, running autonomously on AWS ECS (Elastic Container Service). 

### Threading Model
* **File:** `ecs-trading-app/main.py`
* The bot executes **multiple strategies perfectly in parallel** using Python's native `threading` module.
* Every active strategy listed in `ACTIVE_STRATEGIES` is spawned as a daemon thread. 
* The main loop remains alive to monitor the threads, handle global Daily MTM (Mark-to-Market) P&L limits, and execute graceful shutdowns at 15:20 IST.
* ECS Restart Prevention: If all threads complete (targets hit or 15:20 cutoff reached), the main script deliberately sleeps until 15:40 rather than exiting. This prevents AWS ECS from infinitely rebooting the container assuming a crash.

### Global P&L Tracking (Production Mode)
* `main.py` contains commented-out production blocks for tracking global portfolio health.
* It calculates `get_positions_and_pnl()` actively.
* **Hard Stop**: Evaluates against `DAILY_MAX_LOSS` (e.g., -₹3000) defined in `config.py`.
* **Dynamic Peak Trailing**: Records `peak_pnl` and uses `get_dynamic_stop()` to dynamically lock in profits across the entire portfolio.

---

## 2. Strategy Engine Design
The underlying strategy engines (`straddle_forward_test.py` and `testing_reversal.py`) are built out of decoupled, highly optimized components. None of them use endless `while True:` polling loops that aggressively block CPU.

### A. The Unified State Machine (Straddle Example)
Strategies progress through strict states to save API calls and server CPU:
1. **WAITING:** Calculates exact time remaining until the strategy's entry window. It uses `time.sleep()` to silently wait until exactly 60 seconds before entry.
2. **SCANNING:** Wakes up, fetches Nifty Spot, rounds to the nearest ATM strike, and polls LTP (Last Traded Price) / VWAP until the entry condition (e.g., premium dips below VWAP) is met.
3. **MONITORING:** Once a position is opened, loop checks Target, Stoploss, and Trailing Stoploss limits every `POLL_INTERVAL_SEC`.

### B. Universal Trailing Stoploss Mechanic
Both the Straddle and the Reversal strategies use the **exact same** trailing stoploss math to protect winning trades:
1. **Activation:** If the trade's `max_pnl` reaches **+20 points**, the initial stoploss (typically -20 or -25 points) is immediately snapped to **0 points** (cost-to-cost).
2. **Trailing Ladder:** For every additional `20 points` of profit generated (40, 60, 80...), the stoploss trails strictly upwards by `10 points` (+10, +20, +30...).
3. **Execution:** Logs `"trailing_sl_hit"` in `straddle_trades.csv` and via Telegram if triggered.

---

## 3. Core Strategies Implemented

### Strategy 1: Short Straddle (`straddle_forward_test.py`)
* **Concept:** Sells ATM Call and ATM Put simultaneously.
* **Variations:** 
  1. `straddle_time1`: Enters at 10:00 AM. Looks at the first 45-min Nifty range. If the range exceeds 120 pts, the trade is skipped (trending day avoidance).
  2. `straddle_time2`: Enters at 10:50 AM. Looks at the morning range. Skips if > 150 pts.
* **Entry Logic:** Fetches historical 5-min candles to compute Anchored VWAP. The bot only enters the short straddle when the live combined premium dips *below* the combined VWAP. 
* **Limits:** Target is +40/50 pts, Initial SL is -20/25 pts.

### Strategy 2: Pivot Multi-Level Intraday Reversal (`testing_reversal.py`)
* **Concept:** Option selling based on previous day pivot levels and live Supertrend data.
* **Entry Logic:** 
  * **Sell Put (Bullish):** Nifty touches Support (S1/S2) + Bullish Candlestick Pattern OR Supertrend flips bullish.
  * **Sell Call (Bearish):** Nifty touches Resistance (R1/R2) + Bearish Candlestick Pattern OR Supertrend flips bearish.
* **Strategy Exits:** If Supertrend flips against the position, or if Nifty breaks the recorded Day Low / Day High of the entry, it forces a market exit regardless of PnL limits.
* **Limits:** Target is +70 pts, Initial SL is -20 pts.

---

## 4. Shared Utilities & Infrastructure
The `utils/` folder provides stateless helper functions imported across all strategies.

* **Cache Loading:** NFO (Futures & Options) instruments heavily weigh down network calls. Strategies use `_load_nfo()` to fetch ~90,000 instruments precisely *once per session* and cache them in memory.
* **`common_utils.py`**: Calculates the dynamic trailing logic for the global portfolio P&L in `main.py`.
* **`telegram_alert.py`**: Pushes rich text alerts on Entry, Target Hit, SL Hit, and EOD Summary.
* **`trade_logger.py` & `s3_utils.py`**: Appends trades to CSV files in a volume-mounted `/tmp` directory. At 15:20 `main.py` gracefully triggers S3 uploads ensuring no data loss on ECS container teardown.
* **Timezone Safety (`config.py`)**: Defines `IST = pytz.timezone("Asia/Kolkata")`. AWS runs on UTC. The code strictly enforces `datetime.now(IST)` globally so cron jobs, expiries, and daily boundary resets align perfectly with Indian markets.

---

## 5. AWS Deployment & Daily Lifecycle
The entire CI/CD and production execution pipeline is fully automated and severely cost-optimized (only running during market hours) via AWS CloudFormation.

### 5.1 CI/CD Github Actions Pipeline (`.github/workflows/deploy.yml`)
When code is pushed to the `main` branch, Github Actions automatically:
1. Builds the `ecs-trading-app` Docker image and pushes it to an **AWS Elastic Container Registry (ECR)**.
2. Zips and updates the `token-generator` Lambda into an S3 deployment bucket.
3. Automatically deploys 4 individual **CloudFormation Stacks**:
   - `nifty-trading-bot` (ECS Fargate Services)
   - `token-generator` (AWS Lambda to parse authentication)
   - `nifty-token-page` (CloudFront + User HTML UI to generate Auth Tokens)
   - `ecs-trading-bot-scheduler` (EventBridge Cron tasks)

### 5.2 Serverless Cron Scheduling (`ecs-scheduler.yaml`)
To save money, the bot absolutely *does not* run 24/7.
Instead, an AWS Lambda (`ECSStartStopLambda`) controls the container's `desiredCount` via severe AWS EventBridge rules:
* **START (Market Open):** At exactly **09:10 IST** (`cron(40 3 ? * MON-FRI)`), EventBridge triggers the lambda to set ECS Desired Count to `1`. The Docker container boots up 5 minutes before the market opens, logs into Kite, loads the 90,000 NFO instruments into RAM cache, and awaits the 09:15 open.
* **SHUTDOWN (Market Close):** At exactly **15:40 IST** (`cron(10 10 ? * MON-FRI)`), EventBridge forces the ECS Desired Count to `0`. The container is violently destroyed, eliminating computing costs until the next day.

### 5.3 The `15:20 to 15:40` Buffer Period
* Because the container is forcefully killed at `15:40`, the actual Python bot (`main.py`) controls its own end-of-day timeline flawlessly. 
* At `15:20`, it triggers `graceful_shutdown()`, uploads all CSV trade logs and plot charts safely up to an S3 Bucket (`_upload_logs_to_s3()`), and alerts Telegram that the day is over.
* It then commands `time.sleep()` until `15:40`. If it exited the script cleanly at `15:20`, ECS would think the bot crashed and reboot the entire container endlessly! By sleeping, it waits securely for EventBridge to spin the container count to `0` from the outside.
