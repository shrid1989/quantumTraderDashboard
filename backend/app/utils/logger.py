"""Logging setup for QuantumTrader Dashboard"""
import logging
import os
from datetime import datetime
from app.config import LOG_DIR, LOG_LEVEL

# Create logs directory if it doesn't exist
os.makedirs(LOG_DIR, exist_ok=True)

# Create a logger
logger = logging.getLogger("quantumtrader")
logger.setLevel(getattr(logging, LOG_LEVEL))

# Create a file handler with date-based naming
log_filename = f"{LOG_DIR}/dashboard_{datetime.now().strftime('%Y-%m-%d')}.log"
file_handler = logging.FileHandler(log_filename)
file_handler.setLevel(getattr(logging, LOG_LEVEL))

# Create a console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(getattr(logging, LOG_LEVEL))

# Create a formatter
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# Add handlers to the logger
logger.addHandler(file_handler)
logger.addHandler(console_handler)

def get_logger():
    """Get the configured logger"""
    return logger
