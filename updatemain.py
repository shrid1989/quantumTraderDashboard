"""
main.py — Trading Bot Entry Point

─── CURRENT MODE: PAPER TRADING ONLY ───────────────────────────────────────
  P&L tracking, stop-loss, and graceful shutdown are fully written out but
  commented. Uncomment each section when ready to go live.

─── HOW TO ADD / SWITCH STRATEGIES ─────────────────────────────────────────
  1. Create your strategy file e.g. my_strategy.py
     Must expose a single callable:  my_strategy(kite)
  2. Import it in the STRATEGY REGISTRY section below
  3. Add it to STRATEGY_MAP.
     Strategies run in PARALLEL threads — one thread per strategy.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import signal
import time
import threading
# import csv                                      # ← P&L logging
from datetime import datetime, time as dt_time

import boto3
import pytz
from supabase import create_client
from dotenv import load_dotenv

from config import LOG_DIR, IST, IMG_DIR
from kite_login import get_kite
# from config import DAILY_MAX_LOSS, PATENT_DIR   # ← P&L / shutdown
# from utils.common_utils import get_dynamic_stop, Colors  # ← P&L
# from utils.excel_utils import write_daily_summary        # ← EOD summary
from utils.telegram_alert import send_telegram_alert
# from plot_option_orders_on_nifty import plot_option_orders_on_nifty  # ← EOD chart
# from position_management.position_store import PositionStore         # ← live positions
# from position_management.order_manager import exit_position          # ← live exit orders

load_dotenv()


# ─────────────────────────────────────────────────────────────────────────────
# STRATEGY REGISTRY  — only edit this section to add/remove strategies
# ─────────────────────────────────────────────────────────────────────────────

from testing_reversal import paper_trading_strategy
from straddle_forward_test import straddle_time1
from straddle_forward_test import straddle_time2

# from my_new_strategy import my_new_strategy   # ← add new strategy here

# Define the logical names matching your database against the actual functions
STRATEGY_MAP = {
    "reversal_pivot_supertrend": paper_trading_strategy,
    "straddle_time1": straddle_time1,             # 10:00 entry — first-hour range filter
    "straddle_time2": straddle_time2,             # 10:50 entry — morning range filter, highest win-rate
    # "my_new_strategy": my_new_strategy,         # ← uncomment to enable
}

def fetch_active_strategies():
    """Fetch today's active strategies directly from Supabase."""
    try:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            print("  ⚠  Missing SUPABASE_URL or SUPABASE_KEY in env. Running ALL strategies.")
            return list(STRATEGY_MAP.keys())

        supabase = create_client(url, key)

        now = datetime.now(IST)
        today_str = now.strftime("%Y-%m-%d")
        today_dow = now.weekday()  # 0=Mon..4=Fri

        if today_dow > 4:
            print("  ⚠  Weekend — no strategies to run")
            return []

        # 1. Check date-specific overrides first (highest priority)
        overrides = (
            supabase.table("strategy_overrides")
            .select("strategy_name, is_active")
            .eq("specific_date", today_str)
            .execute()
        ).data or []
        override_map = {r["strategy_name"]: r["is_active"] for r in overrides}

        # 2. Fall back to active_days array schedule
        schedules = (
            supabase.table("strategy_schedules")
            .select("strategy_name, active_days")
            .execute()
        ).data or []
        schedule_map = {r["strategy_name"]: r["active_days"] or [] for r in schedules}

        # 3. Resolve: override > active_days > default active
        active = []
        for s in STRATEGY_MAP.keys():
            if s in override_map:
                is_on = override_map[s]
            elif s in schedule_map:
                is_on = today_dow in schedule_map[s]
            else:
                is_on = True
            
            if is_on:
                active.append(s)

        print(f"  ✓ Today ({today_str}): Active strategies = {active}")
        return active
    except Exception as e:
        print(f"  ✗ Failed to fetch schedule from Supabase, using ALL strategies as fallback: {e}")
        return list(STRATEGY_MAP.keys())

# Resolve what to launch today
active_names = fetch_active_strategies()
ACTIVE_STRATEGIES = [STRATEGY_MAP[name] for name in active_names if name in STRATEGY_MAP]


# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

IS_LOCAL         = os.getenv("IS_LOCAL")
SLEEP_INTERVAL   = 5
MARKET_OPEN_TIME = dt_time(9, 15)
MARKET_EXIT_TIME = dt_time(15, 20)

os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(IMG_DIR, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# KITE CONNECTION  — auto-login (password + TOTP, daily token cache)
# ─────────────────────────────────────────────────────────────────────────────

# Local  : credentials from .env  (KITE_API_KEY, KITE_API_SECRET, KITE_USER_ID,
#                                   KITE_PASSWORD, KITE_TOTP_SECRET)
# ECS    : credentials from AWS Secrets Manager secret "kite/credentials" (JSON)
kite = get_kite()
print(f"✓ Connected: {kite.profile()['user_id']}")


# ─────────────────────────────────────────────────────────────────────────────
# BOT STATE
# ─────────────────────────────────────────────────────────────────────────────

class BotState:
    def __init__(self):
        # Strategy control
        self.strategy_started   = False     # prevents re-launching threads each tick
        self.shutdown_triggered = False     # prevents duplicate shutdown calls

        # ── P&L STATE — uncomment for live trading ────────────────────────────
        # self.peak_pnl                = 0.0
        # self.max_drawdown            = 0.0
        # self.current_stop            = DAILY_MAX_LOSS
        # self.total_exits             = 0
        # self.hard_stop_triggered     = False
        # self.dynamic_stop_triggered  = False
        # self.summary_written         = False
        # self.hard_stop_alert_sent    = False
        # self.dynamic_stop_alert_sent = False
        # self.daily_summary_sent      = False
        # ─────────────────────────────────────────────────────────────────────

state = BotState()


# ─────────────────────────────────────────────────────────────────────────────
# TELEGRAM HELPER
# ─────────────────────────────────────────────────────────────────────────────

def send_alert(message: str) -> None:
    """Send Telegram alert — errors swallowed so the bot never crashes here."""
    try:
        send_telegram_alert(message)
    except Exception as e:
        print(f"  ⚠  Telegram failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# ░░░  P&L TRACKING  — uncomment entire section for live trading  ░░░░░░░░░░░
# ─────────────────────────────────────────────────────────────────────────────

# def get_positions_and_pnl() -> tuple:
#     """Return (all_positions, active_positions, total_pnl)."""
#     positions        = kite.positions()["net"]
#     active_positions = [p for p in positions if p["quantity"] != 0]
#     total_pnl        = sum(p["pnl"] for p in positions)
#     return positions, active_positions, total_pnl
#
#
# def log_pnl_event(event: str, total_pnl: float, peak_pnl: float, stop: float) -> None:
#     """Append a timestamped event row to pnl_log.csv."""
#     filename    = os.path.join(LOG_DIR, "pnl_log.csv")
#     file_exists = os.path.isfile(filename)
#     now         = datetime.now(IST)
#     with open(filename, "a", newline="") as f:
#         writer = csv.writer(f)
#         if not file_exists:
#             writer.writerow(["Date", "Time", "Event", "Total_PnL", "Peak_PnL", "Current_Stop"])
#         writer.writerow([now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S"),
#                          event, total_pnl, peak_pnl, stop])
#
#
# def check_peak_pnl(total_pnl: float) -> None:
#     """Trail peak PnL and recalculate dynamic stop-loss level."""
#     if total_pnl > state.peak_pnl:
#         state.peak_pnl     = total_pnl
#         state.current_stop = get_dynamic_stop(state.peak_pnl)
#         log_pnl_event("PEAK_UPDATED", total_pnl, state.peak_pnl, state.current_stop)
#         print(f"{Colors.OKGREEN}📈 Peak: ₹{state.peak_pnl:.2f}  Stop: ₹{state.current_stop:.2f}{Colors.ENDC}")
#
#
# def check_stop_loss(total_pnl: float, active_positions: list) -> None:
#     """Fire hard stop and dynamic trailing stop alerts — once each per session."""
#     # Hard stop — absolute daily loss limit
#     if total_pnl <= DAILY_MAX_LOSS and active_positions and not state.hard_stop_triggered:
#         state.hard_stop_triggered = True
#         log_pnl_event("HARD_KILL", total_pnl, state.peak_pnl, state.current_stop)
#         print(f"{Colors.FAIL}🛑 HARD STOP: ₹{total_pnl:.2f} ≤ ₹{DAILY_MAX_LOSS}{Colors.ENDC}")
#         if not state.hard_stop_alert_sent:
#             send_alert(f"🛑 HARD STOP\nPnL: ₹{total_pnl:.2f}  Limit: ₹{DAILY_MAX_LOSS}")
#             state.hard_stop_alert_sent = True
#     # Dynamic trailing stop — tightens as profit grows
#     if total_pnl <= state.current_stop and active_positions and not state.dynamic_stop_triggered:
#         state.dynamic_stop_triggered = True
#         log_pnl_event("DYNAMIC_STOP_HIT", total_pnl, state.peak_pnl, state.current_stop)
#         print(f"{Colors.WARNING}⚠️ Dynamic stop: ₹{total_pnl:.2f}  Stop: ₹{state.current_stop:.2f}{Colors.ENDC}")
#         if not state.dynamic_stop_alert_sent:
#             send_alert(f"⚠️ DYNAMIC STOP\nPnL: ₹{total_pnl:.2f}  Stop: ₹{state.current_stop:.2f}")
#             state.dynamic_stop_alert_sent = True


# ─────────────────────────────────────────────────────────────────────────────
# ░░░  GRACEFUL SHUTDOWN  — uncomment entire section for live trading  ░░░░░░░
# ─────────────────────────────────────────────────────────────────────────────

# def _upload_logs_to_s3() -> None:
#     """Upload all files in PATENT_DIR to S3 at end of session."""
#     s3     = boto3.client("s3")
#     BUCKET = "shri-trading-logs"
#     for root, _, files in os.walk(PATENT_DIR):
#         for fname in files:
#             if fname.startswith("."):
#                 continue
#             local = os.path.join(root, fname)
#             key   = local.replace("/tmp/", "")
#             try:
#                 s3.upload_file(local, BUCKET, key)
#             except Exception as e:
#                 print(f"  ⚠  S3 upload failed ({fname}): {e}")
#
#
# def graceful_shutdown(reason: str, total_pnl: float, active_positions: list) -> None:
#     """
#     Exit all open positions, write daily summary, upload logs, send Telegram.
#     Called at market close (15:20) or on unhandled exception.
#     DRY_RUN=True logs without placing real orders.
#     """
#     DRY_RUN = True      # ← set False only when going fully live
#     print(f"🧯 Shutdown: {reason}")
#
#     for pos in active_positions:
#         sym = pos["tradingsymbol"]
#         if DRY_RUN:
#             print(f"  [DRY-RUN] Would exit {sym}  qty={pos['quantity']}")
#         else:
#             try:
#                 exit_position(kite, pos, reason)
#                 state.total_exits += 1
#             except Exception as e:
#                 print(f"  ✗ Exit failed {sym}: {e}")
#
#     if not state.summary_written:
#         try:
#             write_daily_summary(
#                 peak_pnl            = state.peak_pnl,
#                 final_pnl           = total_pnl,
#                 current_stop        = state.current_stop,
#                 total_exits         = state.total_exits,
#                 hard_stop_triggered = state.hard_stop_triggered,
#                 max_drawdown        = state.max_drawdown,
#             )
#             state.summary_written = True
#         except Exception as e:
#             print(f"  ⚠  Summary write failed: {e}")
#
#     try:
#         plot_option_orders_on_nifty(kite)
#     except Exception as e:
#         print(f"  ⚠  Plot failed: {e}")
#
#     _upload_logs_to_s3()
#
#     if not state.daily_summary_sent:
#         send_alert(
#             f"📊 Daily Summary\n"
#             f"Peak  : ₹{state.peak_pnl:.2f}\n"
#             f"Final : ₹{total_pnl:.2f}\n"
#             f"Stop  : ₹{state.current_stop:.2f}\n"
#             f"Exits : {state.total_exits}\n"
#             f"Hard stop: {state.hard_stop_triggered}"
#         )
#         state.daily_summary_sent = True


# ─────────────────────────────────────────────────────────────────────────────
# SIGNAL HANDLER
# ─────────────────────────────────────────────────────────────────────────────

def _sigterm_handler(signum, frame):
    print("  SIGTERM — shutting down")
    sys.exit(0)

signal.signal(signal.SIGTERM, _sigterm_handler)


# ─────────────────────────────────────────────────────────────────────────────
# STRATEGY RUNNER
# ─────────────────────────────────────────────────────────────────────────────

def _run_strategy(fn) -> None:
    """Run one strategy function in its own thread. Catches and prints any crash."""
    name = fn.__name__
    print(f"\n  ▶ [{name}] started")
    try:
        fn(kite)
        print(f"  ■ [{name}] completed")
    except Exception as e:
        print(f"  ✗ [{name}] crashed: {e}")
        import traceback
        traceback.print_exc()


_strategy_threads: list = []    # module-level so main loop can join them on shutdown

def launch_strategies() -> None:
    """Spawn one daemon thread per strategy in ACTIVE_STRATEGIES."""
    for strategy_fn in ACTIVE_STRATEGIES:
        t = threading.Thread(
            target=_run_strategy,
            args=(strategy_fn,),
            name=strategy_fn.__name__,
            daemon=True,    # safety net — killed if main exits unexpectedly
        )
        t.start()
        _strategy_threads.append(t)
        print(f"  ▶ Launched: {strategy_fn.__name__}")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN LOOP
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "═" * 62)
print("  Paper Trading Bot  |  Mode: PAPER")
print(f"  Active strategies : {[fn.__name__ for fn in ACTIVE_STRATEGIES]}")
print("═" * 62 + "\n")

try:
    while True:
        now = datetime.now(IST)

        # ── Launch all strategies once at market open ─────────────────────────
        if (
            MARKET_OPEN_TIME <= now.time() < dt_time(15, 15)
            and not state.strategy_started
        ):
            state.strategy_started = True
            if ACTIVE_STRATEGIES:
                launch_strategies()
            else:
                print("  🔕 No strategies scheduled to run today based on Supabase.")

        # ── Smart Dynamic Idle (Solution 2) ───────────────────────────────────
        # If all threads die naturally (e.g. hit targets early) or we hit 15:20 cutoff
        all_threads_dead = state.strategy_started and all(not t.is_alive() for t in _strategy_threads)
        time_cutoff_hit  = now.time() >= MARKET_EXIT_TIME

        if (all_threads_dead or time_cutoff_hit) and not state.shutdown_triggered:
            state.shutdown_triggered = True

            if all_threads_dead and ACTIVE_STRATEGIES:
                print(f"\n  ✓ All strategies naturally completed. Performing EOD Clean-up at {now.strftime('%H:%M')}...")
            elif ACTIVE_STRATEGIES:
                print(f"\n  ✓ {MARKET_EXIT_TIME.strftime('%H:%M')} — market closed cutoff reached. Forcing Cleanup...")
                print("  ⏳ Waiting up to 3 mins for any lingering strategy threads...")
                for t in _strategy_threads:
                    t.join(timeout=180)
                    status = "done" if not t.is_alive() else "timed out (still alive)"
                    print(f"     {t.name}: {status}")

            # send_alert("📋 Paper trading session ended — all strategies complete")
            # ── uncomment below for live trading ──────────────────────────────
            # _, active_positions, total_pnl = get_positions_and_pnl()
            # graceful_shutdown("Strategies Completed" if all_threads_dead else "Market Close", total_pnl, active_positions)
            
            print("\n  [IDLE STATE] Cleanup complete. Sleeping to prevent recursive ECS restart loops until EventBridge timeout.")

        # If the bot has completed everything, it should just sleep gracefully in the 
        # background to prevent AWS ECS Services from infinitely rebooting the script.
        if state.shutdown_triggered:
            now = datetime.now(IST)
            target_time = datetime.combine(now.date(), dt_time(15, 40), tzinfo=IST)
            secs_until_target = (target_time - now).total_seconds()
            
            if secs_until_target > 0:
                time.sleep(secs_until_target)
            else:
                time.sleep(60) # Fallback if we are already past 15:40
                
            continue

        # ── P&L checks — uncomment for live trading ───────────────────────────
        # _, active_positions, total_pnl = get_positions_and_pnl()
        # state.max_drawdown = min(state.max_drawdown, total_pnl)
        # check_peak_pnl(total_pnl)
        # check_stop_loss(total_pnl, active_positions)
        # print(f"  {now.strftime('%H:%M:%S')}  PnL: ₹{total_pnl:.2f}  Peak: ₹{state.peak_pnl:.2f}  Stop: ₹{state.current_stop:.2f}")

        print(f"  {now.strftime('%H:%M:%S')}  |  strategies running...")
        time.sleep(SLEEP_INTERVAL)

except Exception as e:
    print(f"\n  ✗ Bot error: {e}")
    import traceback
    traceback.print_exc()
    # ── uncomment below for live trading ──────────────────────────────────────
    # _, active_positions, total_pnl = get_positions_and_pnl()
    # graceful_shutdown("Exception", total_pnl, active_positions)
