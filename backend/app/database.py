"""Supabase database client for QuantumTrader Dashboard"""
from typing import List, Dict, Optional
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_KEY
from app.utils.logger import get_logger
from app.utils.exceptions import DatabaseException

logger = get_logger()

_db_client = None


class SupabaseClient:
    """Supabase PostgreSQL client wrapper"""

    def __init__(self):
        """Initialize Supabase client"""
        try:
            self.client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
            logger.info("✓ Supabase client connected")
        except Exception as e:
            logger.error(f"✗ Failed to connect to Supabase: {str(e)}")
            raise DatabaseException(f"Supabase connection failed: {str(e)}")

    def create_table_if_not_exists(self):
        """No-op: table is created via Supabase SQL migration (supabase/migrations/)"""
        logger.info("✓ Table managed via Supabase migrations")

    def put_item(self, item: Dict) -> bool:
        """Insert or update a trade (upsert on trade_id)"""
        try:
            self.client.table("trades").upsert(item, on_conflict="trade_id").execute()
            return True
        except Exception as e:
            logger.error(f"✗ Failed to put item: {str(e)}")
            raise DatabaseException(f"Put item failed: {str(e)}")

    def get_item(self, trade_id: str, timestamp: str = None) -> Optional[Dict]:
        """Get a trade by trade_id"""
        try:
            response = self.client.table("trades").select("*").eq("trade_id", trade_id).maybe_single().execute()
            return response.data
        except Exception as e:
            logger.error(f"✗ Failed to get item: {str(e)}")
            raise DatabaseException(f"Get item failed: {str(e)}")

    def query_by_date(self, date: str, limit: int = 1000) -> List[Dict]:
        """Get trades for a specific date"""
        try:
            response = (
                self.client.table("trades")
                .select("*")
                .eq("date", date)
                .order("entry_time")
                .limit(limit)
                .execute()
            )
            return response.data or []
        except Exception as e:
            logger.error(f"✗ Failed to query by date: {str(e)}")
            raise DatabaseException(f"Query by date failed: {str(e)}")

    def query_by_strategy(self, strategy: str, limit: int = 1000) -> List[Dict]:
        """Get trades for a specific strategy"""
        try:
            response = (
                self.client.table("trades")
                .select("*")
                .eq("strategy", strategy)
                .order("date", desc=True)
                .limit(limit)
                .execute()
            )
            return response.data or []
        except Exception as e:
            logger.error(f"✗ Failed to query by strategy: {str(e)}")
            raise DatabaseException(f"Query by strategy failed: {str(e)}")

    def scan_all(self, limit: int = 5000) -> List[Dict]:
        """Get all trades ordered by date descending"""
        try:
            response = (
                self.client.table("trades")
                .select("*")
                .order("date", desc=True)
                .limit(limit)
                .execute()
            )
            items = response.data or []
            logger.info(f"✓ Fetched {len(items)} total trades")
            return items
        except Exception as e:
            logger.error(f"✗ Failed to fetch all trades: {str(e)}")
            raise DatabaseException(f"Fetch all failed: {str(e)}")

    def delete_item(self, trade_id: str, timestamp: str = None) -> bool:
        """Delete a trade by trade_id"""
        try:
            self.client.table("trades").delete().eq("trade_id", trade_id).execute()
            return True
        except Exception as e:
            logger.error(f"✗ Failed to delete item: {str(e)}")
            raise DatabaseException(f"Delete item failed: {str(e)}")

    def update_item(self, trade_id: str, timestamp: str = None, attributes: Dict = None) -> bool:
        """Update a trade's attributes"""
        try:
            if not attributes:
                return True
            self.client.table("trades").update(attributes).eq("trade_id", trade_id).execute()
            return True
        except Exception as e:
            logger.error(f"✗ Failed to update item: {str(e)}")
            raise DatabaseException(f"Update item failed: {str(e)}")


_db_client: Optional[SupabaseClient] = None


def get_db_client() -> SupabaseClient:
    """Get singleton Supabase client"""
    global _db_client
    if _db_client is None:
        _db_client = SupabaseClient()
    return _db_client
