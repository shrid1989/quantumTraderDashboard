"""Custom exceptions for QuantumTrader Dashboard API"""


class QuantumTraderException(Exception):
    """Base exception for all QuantumTrader errors"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class InvalidCredentialsException(QuantumTraderException):
    """Raised when login credentials are invalid"""
    def __init__(self, message: str = "Invalid email or password"):
        super().__init__(message, 401)


class TokenExpiredException(QuantumTraderException):
    """Raised when JWT token is expired"""
    def __init__(self, message: str = "Token has expired"):
        super().__init__(message, 401)


class InvalidTokenException(QuantumTraderException):
    """Raised when JWT token is invalid"""
    def __init__(self, message: str = "Invalid token"):
        super().__init__(message, 401)


class CSVParseException(QuantumTraderException):
    """Raised when CSV parsing fails"""
    def __init__(self, message: str = "Failed to parse CSV file"):
        super().__init__(message, 400)


class S3AccessException(QuantumTraderException):
    """Raised when S3 access fails"""
    def __init__(self, message: str = "Failed to access S3 bucket"):
        super().__init__(message, 500)


class DatabaseException(QuantumTraderException):
    """Raised when database operation fails"""
    def __init__(self, message: str = "Database operation failed"):
        super().__init__(message, 500)


# Backward-compatible alias
DynamoDBException = DatabaseException


class TradeNotFound(QuantumTraderException):
    """Raised when trade is not found"""
    def __init__(self, message: str = "Trade not found"):
        super().__init__(message, 404)


class InvalidDataException(QuantumTraderException):
    """Raised when data validation fails"""
    def __init__(self, message: str = "Invalid data"):
        super().__init__(message, 400)
