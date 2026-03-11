"""Upload routes for QuantumTrader Dashboard API"""
from fastapi import APIRouter, HTTPException, status, UploadFile, File

from app.models import CSVUploadResponse
from app.services.trade_service import get_trade_service
from app.services.csv_parser import CSVParserService
from app.utils.logger import get_logger
from app.utils.exceptions import CSVParseException, DatabaseException

logger = get_logger()

# Create router
router = APIRouter(tags=["Upload"])

# Get services
trade_service = get_trade_service()
csv_parser = CSVParserService()


@router.post("/api/upload/csv", response_model=CSVUploadResponse)
async def upload_csv(file: UploadFile = File(...)):
    """
    Upload and import CSV file

    Request:
    - file: CSV file (trades_YYYY-MM-DD.csv format)

    Returns:
    - status: Upload status
    - message: Status message
    - trades_added: Number of trades added
    - trades_updated: Number of trades updated
    """
    try:
        if not file.filename:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

        # Read file content
        content = await file.read()
        csv_content = content.decode("utf-8")

        # Validate CSV structure first
        is_valid, validation_msg = csv_parser.validate_csv_structure(csv_content)
        if not is_valid:
            logger.warning(f"CSV validation failed: {validation_msg}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid CSV format: {validation_msg}",
            )

        # Parse CSV
        trades = csv_parser.parse_csv_content(csv_content)
        logger.info(f"✓ Parsed {len(trades)} trades from upload: {file.filename}")

        # Import trades into database
        trades_added = 0
        errors = []

        for trade in trades:
            try:
                trade_service.upsert_trade(trade)
                trades_added += 1
            except Exception as e:
                error_msg = f"Failed to import trade: {str(e)}"
                logger.warning(error_msg)
                errors.append(error_msg)
                continue

        logger.info(f"✓ Upload complete: {trades_added} trades imported")

        return CSVUploadResponse(
            status="success",
            message=f"Imported {trades_added} trades successfully",
            trades_added=trades_added,
            trades_updated=0,
            errors=errors,
        )

    except CSVParseException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV parsing error: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"✗ Upload failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}",
        )
