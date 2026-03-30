from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from finance_svc.core.database import get_db
from finance_svc.models.user import User
from finance_svc.dependencies import get_current_user
from finance_svc.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse, TransactionListResponse
from finance_svc.services import transaction_service

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.get("", response_model=TransactionListResponse)
def list_transactions(
    wallet_id: str | None = Query(None),
    category_id: str | None = Query(None),
    type: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    is_reviewed: bool | None = Query(None),
    keyword: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return transaction_service.list_transactions(
        db, current_user.id, wallet_id, category_id, type,
        date_from, date_to, is_reviewed, keyword, page, page_size,
    )


@router.post("", response_model=TransactionResponse, status_code=201)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return transaction_service.create_transaction(db, current_user.id, data)


@router.get("/export")
def export_csv(
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    csv_data = transaction_service.export_transactions_csv(db, current_user.id, date_from, date_to)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return transaction_service.get_transaction(db, current_user.id, transaction_id)


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(transaction_id: str, data: TransactionUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return transaction_service.update_transaction(db, current_user.id, transaction_id, data)


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    transaction_service.delete_transaction(db, current_user.id, transaction_id)
