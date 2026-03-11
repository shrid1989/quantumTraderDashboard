"""FastAPI application for QuantumTrader Dashboard"""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime

from app.config import API_TITLE, API_VERSION, API_DESCRIPTION, CORS_ORIGINS, IS_LOCAL
from app.utils.logger import get_logger
from app.utils.exceptions import QuantumTraderException
from app.database import get_db_client

# Initialize logger
logger = get_logger()

# Create FastAPI app
app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description=API_DESCRIPTION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler for custom exceptions
@app.exception_handler(QuantumTraderException)
async def quantumtrader_exception_handler(request: Request, exc: QuantumTraderException):
    """Handle custom QuantumTrader exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint - API health check"""
    return {
        "message": "QuantumTrader Dashboard API",
        "version": API_VERSION,
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "environment": "local" if IS_LOCAL else "production",
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        db = get_db_client()
        db.client.table("trades").select("trade_id").limit(1).execute()
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
            },
        )


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize app on startup"""
    logger.info("=" * 50)
    logger.info("🚀 QuantumTrader Dashboard API Starting...")
    logger.info(f"Environment: {'LOCAL' if IS_LOCAL else 'PRODUCTION'}")
    logger.info(f"API Version: {API_VERSION}")

    try:
        # Initialize Supabase client
        db = get_db_client()
        logger.info("✓ Supabase database initialized")
    except Exception as e:
        logger.error(f"✗ Failed to initialize database: {str(e)}")
        raise

    logger.info("=" * 50)


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("🛑 QuantumTrader Dashboard API Shutting down...")


# Import and include routers
from app.api.routes import auth, trades, dashboard, strategy, upload

# Register routers
app.include_router(auth.router)
app.include_router(trades.router)
app.include_router(dashboard.router)
app.include_router(strategy.router)
app.include_router(upload.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=IS_LOCAL,
    )
