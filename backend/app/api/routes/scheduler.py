"""Strategy Scheduler routes for QuantumTrader Dashboard API"""
from fastapi import APIRouter, HTTPException, status
from typing import List
from datetime import datetime
import pytz

from app.models import (
    StrategySchedule,
    ScheduleBulkUpdate,
    ScheduleOverrideCreate,
    ScheduleOverride,
    TodayActiveResponse,
)
from app.database import get_db_client
from app.utils.logger import get_logger
from app.utils.exceptions import DatabaseException

logger = get_logger()

# Create router
router = APIRouter(prefix="/api/scheduler", tags=["Scheduler"])

# Known strategies (matches trading bot)
KNOWN_STRATEGIES = [
    "straddle_time1",
    "straddle_time2",
    "reversal_pivot_supertrend",
]

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


@router.get("/schedules", response_model=List[StrategySchedule])
async def get_all_schedules():
    """
    Get all strategy schedules (1 row per strategy with active_days array).
    """
    try:
        db = get_db_client()
        response = (
            db.client.table("strategy_schedules")
            .select("*")
            .order("strategy_name")
            .execute()
        )
        schedules = response.data or []
        logger.info(f"✓ Fetched {len(schedules)} strategy schedules")
        return schedules
    except Exception as e:
        logger.error(f"✗ Failed to fetch schedules: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch schedules: {str(e)}",
        )


@router.put("/schedules")
async def bulk_update_schedules(body: ScheduleBulkUpdate):
    """
    Bulk upsert strategy schedules.
    Each entry has strategy_name + active_days array.
    """
    try:
        db = get_db_client()
        updated = 0
        for schedule in body.schedules:
            row = {
                "strategy_name": schedule.strategy_name,
                "active_days": schedule.active_days,
                "updated_at": datetime.utcnow().isoformat(),
            }
            db.client.table("strategy_schedules").upsert(
                row, on_conflict="strategy_name"
            ).execute()
            updated += 1

        logger.info(f"✓ Bulk updated {updated} strategy schedules")
        return {"status": "success", "updated": updated}
    except Exception as e:
        logger.error(f"✗ Failed to update schedules: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update schedules: {str(e)}",
        )


@router.get("/overrides", response_model=List[ScheduleOverride])
async def get_overrides():
    """Get all date-specific overrides."""
    try:
        db = get_db_client()
        response = (
            db.client.table("strategy_overrides")
            .select("*")
            .order("specific_date", desc=True)
            .execute()
        )
        overrides = response.data or []
        logger.info(f"✓ Fetched {len(overrides)} date overrides")
        return overrides
    except Exception as e:
        logger.error(f"✗ Failed to fetch overrides: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch overrides: {str(e)}",
        )


@router.post("/overrides", response_model=ScheduleOverride)
async def create_override(body: ScheduleOverrideCreate):
    """
    Create a date-specific override.
    Example: Disable straddle_time1 on 2026-03-26 (budget day).
    """
    try:
        db = get_db_client()
        row = {
            "strategy_name": body.strategy_name,
            "specific_date": body.specific_date,
            "is_active": body.is_active,
            "updated_at": datetime.utcnow().isoformat(),
        }
        response = (
            db.client.table("strategy_overrides")
            .upsert(row, on_conflict="strategy_name,specific_date")
            .execute()
        )
        created = response.data[0] if response.data else row
        logger.info(
            f"✓ Override created: {body.strategy_name} on {body.specific_date} = {'ON' if body.is_active else 'OFF'}"
        )
        return created
    except Exception as e:
        logger.error(f"✗ Failed to create override: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create override: {str(e)}",
        )


@router.delete("/overrides/{override_id}")
async def delete_override(override_id: str):
    """Delete a date-specific override by UUID."""
    try:
        db = get_db_client()
        db.client.table("strategy_overrides").delete().eq("id", override_id).execute()
        logger.info(f"✓ Override deleted: {override_id}")
        return {"status": "success", "deleted": override_id}
    except Exception as e:
        logger.error(f"✗ Failed to delete override: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete override: {str(e)}",
        )


@router.get("/today-active")
async def get_today_active():
    """
    Get active strategies for today.
    Used by the trading bot at startup to decide which strategies to launch.

    Logic:
    1. Check date-specific overrides first (highest priority).
    2. Fall back to active_days array in strategy_schedules.
    3. If no schedule entry exists for a strategy, default to active.
    """
    try:
        IST = pytz.timezone("Asia/Kolkata")
        now = datetime.now(IST)
        today_str = now.strftime("%Y-%m-%d")
        today_dow = now.weekday()  # 0=Mon..4=Fri

        # Weekend check
        if today_dow > 4:
            return {
                "date": today_str,
                "day_of_week": today_dow,
                "day_name": now.strftime("%A"),
                "active_strategies": [],
            }

        db = get_db_client()

        # 1. Fetch date-specific overrides for today
        overrides_resp = (
            db.client.table("strategy_overrides")
            .select("strategy_name, is_active")
            .eq("specific_date", today_str)
            .execute()
        )
        override_map = {
            row["strategy_name"]: row["is_active"]
            for row in (overrides_resp.data or [])
        }

        # 2. Fetch strategy schedules (1 row per strategy)
        schedules_resp = (
            db.client.table("strategy_schedules")
            .select("strategy_name, active_days")
            .execute()
        )
        schedule_map = {
            row["strategy_name"]: row["active_days"] or []
            for row in (schedules_resp.data or [])
        }

        # 3. Resolve: override > active_days > default (active)
        active = []
        for strategy in KNOWN_STRATEGIES:
            if strategy in override_map:
                is_active = override_map[strategy]
            elif strategy in schedule_map:
                is_active = today_dow in schedule_map[strategy]
            else:
                is_active = True  # default active if no rule exists
            if is_active:
                active.append(strategy)

        day_name = DAY_NAMES[today_dow] if today_dow < 5 else now.strftime("%A")
        logger.info(f"✓ Today ({today_str}, {day_name}): Active strategies = {active}")

        return {
            "date": today_str,
            "day_of_week": today_dow,
            "day_name": day_name,
            "active_strategies": active,
        }
    except Exception as e:
        logger.error(f"✗ Failed to get today's active strategies: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get today's active strategies: {str(e)}",
        )


@router.get("/strategies")
async def get_known_strategies():
    """Return list of known strategy names (static config)."""
    return KNOWN_STRATEGIES
