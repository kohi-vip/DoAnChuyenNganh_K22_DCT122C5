from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from finance_svc.core.database import get_db
from finance_svc.models.user import User
from finance_svc.dependencies import get_current_user
from finance_svc.schemas.recurring import RecurringCreate, RecurringUpdate, RecurringResponse
from finance_svc.services import recurring_service

router = APIRouter(prefix="/api/recurring", tags=["Recurring Transactions"])


@router.get("", response_model=list[RecurringResponse])
def list_recurring(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return recurring_service.list_recurring(db, current_user.id)


@router.post("", response_model=RecurringResponse, status_code=201)
def create_recurring(data: RecurringCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return recurring_service.create_recurring(db, current_user.id, data)


@router.put("/{rec_id}", response_model=RecurringResponse)
def update_recurring(rec_id: str, data: RecurringUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return recurring_service.update_recurring(db, current_user.id, rec_id, data)


@router.delete("/{rec_id}", status_code=204)
def delete_recurring(rec_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    recurring_service.delete_recurring(db, current_user.id, rec_id)
