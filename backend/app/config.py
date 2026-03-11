import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Flask/FastAPI Configuration
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
IS_LOCAL = os.getenv("IS_LOCAL", "false").lower() == "true"

# Database Configuration (Supabase)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# S3 Configuration (still used by Lambda)
S3_BUCKET = os.getenv("S3_BUCKET", "shri-trading-logs")
S3_PREFIX = "paper-trading"

# Authentication
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Single User Credentials
USER_EMAIL = os.getenv("USER_EMAIL", "trader@quantumtrader.com")
USER_PASSWORD = os.getenv("USER_PASSWORD", "admin@123")

# API Configuration
API_TITLE = "QuantumTrader Dashboard API"
API_VERSION = "1.0.0"
API_DESCRIPTION = "Trading bot performance dashboard"

# CORS Configuration
_frontend_url = os.getenv("FRONTEND_URL", "")
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]
if _frontend_url:
    # Add the exact URL and strip any trailing slash
    clean_url = _frontend_url.rstrip("/")
    CORS_ORIGINS.append(clean_url)

# Allow all Vercel preview/production domains
CORS_ORIGIN_REGEX = r"https://.*\.vercel\.app"

# Logging Configuration
LOG_LEVEL = "INFO"
LOG_DIR = "./logs" if IS_LOCAL else "/tmp/intraday/logs"

# CSV Configuration
CSV_UPLOAD_MAX_SIZE_MB = 10
SUPPORTED_CSV_FORMATS = [".csv"]

# Authentication
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Single User Credentials
USER_EMAIL = os.getenv("USER_EMAIL", "trader@quantumtrader.com")
USER_PASSWORD = os.getenv("USER_PASSWORD", "admin@123")

# API Configuration
API_TITLE = "QuantumTrader Dashboard API"
API_VERSION = "1.0.0"
API_DESCRIPTION = "Trading bot performance dashboard with S3 auto-sync"

# CORS Configuration
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]

# Logging Configuration
LOG_LEVEL = "INFO"
LOG_DIR = "./logs" if IS_LOCAL else "/tmp/intraday/logs"

# CSV Configuration
CSV_UPLOAD_MAX_SIZE_MB = 10
SUPPORTED_CSV_FORMATS = [".csv"]

# Lambda Configuration
LAMBDA_API_KEY = os.getenv("DASHBOARD_API_KEY", "default-api-key")
