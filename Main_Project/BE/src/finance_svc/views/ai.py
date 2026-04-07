import base64
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
import httpx
from finance_svc.core.database import get_db
from finance_svc.core.config import get_settings
from finance_svc.models.user import User
from finance_svc.dependencies import get_current_user
from finance_svc.schemas.ai import (
    ParseTransactionRequest, ParsedTransaction,
    NLQueryRequest, NLQueryResponse,
    InsightResponse, AnomalyResponse,
    ChatRequest, ChatResponse,
    JellyChatRequest, JellyChatResponse,
)
from finance_svc.services import ai_service, ocr_service

settings = get_settings()

router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.post("/parse-transaction", response_model=ParsedTransaction)
def parse_transaction(
    data: ParseTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ai_service.parse_natural_language(db, current_user.id, data.text)


@router.post("/query", response_model=NLQueryResponse)
def nl_query(
    data: NLQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ai_service.natural_language_query(db, current_user.id, data.question)


@router.post("/ocr-receipt", response_model=dict)
async def ocr_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if settings.n8n_ocr_webhook_url:
        file_bytes = await file.read()
        payload = {
            "user_id": current_user.id,
            "image": {
                "name": file.filename or "receipt.jpg",
                "mimeType": file.content_type or "image/jpeg",
                "data": base64.b64encode(file_bytes).decode("utf-8"),
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(settings.n8n_ocr_webhook_url, json=payload)
                response.raise_for_status()
                return response.json()
        except Exception:
            await file.seek(0)

    categories = ai_service._get_user_categories(db, current_user.id)
    return await ocr_service.parse_receipt(file, categories)


@router.get("/insights", response_model=InsightResponse)
def insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ai_service.get_insights(db, current_user.id)


@router.get("/anomalies", response_model=AnomalyResponse)
def anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ai_service.detect_anomalies(db, current_user.id)


@router.post("/chat", response_model=ChatResponse)
def chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ai_service.chat(db, current_user.id, data.message, data.session_id)


@router.post("/jelly-chat", response_model=JellyChatResponse)
async def jelly_chat(
    data: JellyChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ai_service.jelly_chat(
        db,
        current_user.id,
        data.message,
        data.session_id,
        data.image_base64,
        data.image_name,
        data.image_mime_type,
    )
