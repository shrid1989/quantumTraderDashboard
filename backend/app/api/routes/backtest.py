"""Backtest session routes for QuantumTrader Dashboard API"""
from fastapi import APIRouter, HTTPException, status
from typing import List

from app.models import (
    BacktestSessionCreate,
    BacktestSessionSummary,
    BacktestSessionDetail,
)
from app.database import get_db_client
from app.utils.logger import get_logger

logger = get_logger()

router = APIRouter(tags=["Backtest"])


@router.post("/api/backtest/sessions", status_code=status.HTTP_201_CREATED)
async def save_session(payload: BacktestSessionCreate):
    """Save a backtest session with all its trades"""
    try:
        db = get_db_client()

        # 1. Insert session row (without trades)
        session_data = {
            "session_name": payload.session_name,
            "description": payload.description,
            "notes": payload.notes,
            "strategy_name": payload.strategy_name,
            "data_date_from": payload.data_date_from or None,
            "data_date_to": payload.data_date_to or None,
            "total_trades": payload.total_trades,
            "net_pnl": payload.net_pnl,
            "win_rate": payload.win_rate,
            "profit_factor": payload.profit_factor if payload.profit_factor != float("inf") else 999999,
            "max_drawdown": payload.max_drawdown,
            "sharpe_ratio": payload.sharpe_ratio,
            "expectancy": payload.expectancy,
            "risk_reward": payload.risk_reward if payload.risk_reward != float("inf") else 999999,
            "max_win_streak": payload.max_win_streak,
            "max_loss_streak": payload.max_loss_streak,
            "tags": payload.tags,
        }

        result = db.client.table("backtest_sessions").insert(session_data).execute()
        session_id = result.data[0]["id"]

        # 2. Insert trades in batches of 100
        if payload.trades:
            trade_rows = []
            for t in payload.trades:
                trade_rows.append({
                    "session_id": session_id,
                    "date": t.date,
                    "position": t.position,
                    "nifty_at_entry": t.nifty_at_entry,
                    "entry_reason": t.entry_reason,
                    "entry_time": t.entry_time,
                    "entry_price": t.entry_price,
                    "exit_time": t.exit_time,
                    "exit_price": t.exit_price,
                    "exit_reason": t.exit_reason,
                    "pnl_pts": t.pnl_pts,
                    "pnl_inr": t.pnl_inr,
                    "trade_duration": t.trade_duration,
                    "pivot": t.pivot,
                    "r1": t.r1,
                    "r2": t.r2,
                    "s1": t.s1,
                    "s2": t.s2,
                })

            # Batch insert (Supabase supports bulk insert)
            batch_size = 100
            for i in range(0, len(trade_rows), batch_size):
                batch = trade_rows[i:i + batch_size]
                db.client.table("backtest_trades").insert(batch).execute()

        logger.info(f"✓ Saved backtest session '{payload.session_name}' ({len(payload.trades)} trades)")

        return {
            "status": "saved",
            "session_id": session_id,
            "session_name": payload.session_name,
            "trades_saved": len(payload.trades),
        }

    except Exception as e:
        logger.error(f"✗ Failed to save backtest session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save session: {str(e)}",
        )


@router.get("/api/backtest/sessions", response_model=List[BacktestSessionSummary])
async def list_sessions():
    """List all saved backtest sessions (summaries only, no trades)"""
    try:
        db = get_db_client()
        result = (
            db.client.table("backtest_sessions")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        sessions = result.data or []

        # Convert to response model
        return [
            BacktestSessionSummary(
                id=str(s["id"]),
                session_name=s.get("session_name", ""),
                description=s.get("description", ""),
                notes=s.get("notes", ""),
                strategy_name=s.get("strategy_name", ""),
                data_date_from=str(s["data_date_from"]) if s.get("data_date_from") else None,
                data_date_to=str(s["data_date_to"]) if s.get("data_date_to") else None,
                total_trades=s.get("total_trades", 0),
                net_pnl=float(s.get("net_pnl", 0)),
                win_rate=float(s.get("win_rate", 0)),
                profit_factor=float(s.get("profit_factor", 0)),
                max_drawdown=float(s.get("max_drawdown", 0)),
                sharpe_ratio=float(s.get("sharpe_ratio", 0)),
                expectancy=float(s.get("expectancy", 0)),
                risk_reward=float(s.get("risk_reward", 0)),
                max_win_streak=s.get("max_win_streak", 0),
                max_loss_streak=s.get("max_loss_streak", 0),
                tags=s.get("tags", []),
                created_at=str(s["created_at"]) if s.get("created_at") else None,
            )
            for s in sessions
        ]

    except Exception as e:
        logger.error(f"✗ Failed to list backtest sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list sessions: {str(e)}",
        )


@router.get("/api/backtest/sessions/{session_id}")
async def get_session(session_id: str):
    """Get a single session with all its trades"""
    try:
        db = get_db_client()

        # Get session
        session_result = (
            db.client.table("backtest_sessions")
            .select("*")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )

        if not session_result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        s = session_result.data

        # Get trades
        trades_result = (
            db.client.table("backtest_trades")
            .select("*")
            .eq("session_id", session_id)
            .order("date")
            .execute()
        )

        return {
            "id": str(s["id"]),
            "session_name": s.get("session_name", ""),
            "description": s.get("description", ""),
            "notes": s.get("notes", ""),
            "strategy_name": s.get("strategy_name", ""),
            "data_date_from": str(s["data_date_from"]) if s.get("data_date_from") else None,
            "data_date_to": str(s["data_date_to"]) if s.get("data_date_to") else None,
            "total_trades": s.get("total_trades", 0),
            "net_pnl": float(s.get("net_pnl", 0)),
            "win_rate": float(s.get("win_rate", 0)),
            "profit_factor": float(s.get("profit_factor", 0)),
            "max_drawdown": float(s.get("max_drawdown", 0)),
            "sharpe_ratio": float(s.get("sharpe_ratio", 0)),
            "expectancy": float(s.get("expectancy", 0)),
            "risk_reward": float(s.get("risk_reward", 0)),
            "max_win_streak": s.get("max_win_streak", 0),
            "max_loss_streak": s.get("max_loss_streak", 0),
            "tags": s.get("tags", []),
            "created_at": str(s["created_at"]) if s.get("created_at") else None,
            "trades": trades_result.data or [],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"✗ Failed to get backtest session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get session: {str(e)}",
        )


@router.put("/api/backtest/sessions/{session_id}/notes")
async def update_session_notes(session_id: str, payload: dict):
    """Update notes/journal for a session"""
    try:
        db = get_db_client()
        update_data = {}
        if "notes" in payload:
            update_data["notes"] = payload["notes"]
        if "description" in payload:
            update_data["description"] = payload["description"]
        if "session_name" in payload:
            update_data["session_name"] = payload["session_name"]
        if "tags" in payload:
            update_data["tags"] = payload["tags"]

        if not update_data:
            return {"status": "no changes"}

        db.client.table("backtest_sessions").update(update_data).eq("id", session_id).execute()
        return {"status": "updated", "session_id": session_id}

    except Exception as e:
        logger.error(f"✗ Failed to update session notes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update notes: {str(e)}",
        )


@router.delete("/api/backtest/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a backtest session and all its trades (CASCADE)"""
    try:
        db = get_db_client()
        db.client.table("backtest_sessions").delete().eq("id", session_id).execute()
        logger.info(f"✓ Deleted backtest session {session_id}")
        return {"status": "deleted", "session_id": session_id}

    except Exception as e:
        logger.error(f"✗ Failed to delete backtest session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete session: {str(e)}",
        )


@router.post("/api/backtest/compare")
async def compare_sessions(payload: dict):
    """Compare multiple sessions side-by-side"""
    try:
        session_ids = payload.get("session_ids", [])
        if len(session_ids) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 sessions to compare")

        db = get_db_client()
        sessions = []

        for sid in session_ids:
            result = (
                db.client.table("backtest_sessions")
                .select("*")
                .eq("id", sid)
                .maybe_single()
                .execute()
            )
            if result.data:
                s = result.data
                # Also get trades for equity curve
                trades_result = (
                    db.client.table("backtest_trades")
                    .select("date,pnl_inr")
                    .eq("session_id", sid)
                    .order("date")
                    .execute()
                )
                s["trades"] = trades_result.data or []
                sessions.append(s)

        return {"sessions": sessions}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"✗ Failed to compare sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare: {str(e)}",
        )
