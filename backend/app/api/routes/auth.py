"""Authentication routes for QuantumTrader Dashboard API"""
from fastapi import APIRouter, HTTPException, status
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.models import LoginRequest, LoginResponse
from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_DAYS, USER_EMAIL, USER_PASSWORD
from app.utils.logger import get_logger
from app.utils.exceptions import InvalidCredentialsException

logger = get_logger()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create router
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    # For simplicity, we're doing plain comparison in this version
    # In production, use proper hashing
    return plain_password == hashed_password


def create_access_token(email: str, expires_delta: timedelta = None) -> str:
    """Create JWT access token"""
    if expires_delta is None:
        expires_delta = timedelta(days=JWT_EXPIRATION_DAYS)

    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": email, "exp": expire}

    try:
        encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return encoded_jwt
    except Exception as e:
        logger.error(f"Failed to create token: {str(e)}")
        raise InvalidCredentialsException("Failed to create token")


def verify_token(token: str) -> str:
    """Verify JWT token and return email"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise InvalidCredentialsException("Invalid token")
        return email
    except JWTError:
        raise InvalidCredentialsException("Invalid or expired token")


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Login endpoint

    Takes email and password, returns JWT token
    """
    logger.info(f"Login attempt: {request.email}")

    # Check credentials (using environment variables)
    if request.email != USER_EMAIL or request.password != USER_PASSWORD:
        logger.warning(f"Failed login attempt for email: {request.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token = create_access_token(email=request.email)
    logger.info(f"✓ User logged in: {request.email}")

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user_email=request.email,
    )


@router.post("/logout")
async def logout(token: str = None):
    """
    Logout endpoint

    In a stateless JWT system, logout is handled client-side by discarding the token.
    This endpoint is a placeholder for future use (e.g., token blacklisting).
    """
    logger.info("User logged out")
    return {"message": "Logged out successfully"}


@router.get("/verify")
async def verify_token_endpoint(token: str):
    """
    Verify JWT token

    Used to check if a token is valid
    """
    try:
        email = verify_token(token)
        return {
            "valid": True,
            "email": email,
            "message": "Token is valid",
        }
    except InvalidCredentialsException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )
