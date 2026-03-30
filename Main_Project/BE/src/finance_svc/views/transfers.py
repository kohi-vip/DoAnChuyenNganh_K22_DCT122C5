from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from finance_svc.core.database import get_db
from finance_svc.models.user import User
from finance_svc.dependencies import get_current_user
from finance_svc.schemas.transfer import TransferCreate, TransferResponse
from finance_svc.services import transfer_service

router = APIRouter(prefix="/api/transfers", tags=["Transfers"])


@router.get("", response_model=list[TransferResponse])
def list_transfers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return transfer_service.list_transfers(db, current_user.id)


@router.post("", response_model=TransferResponse, status_code=201)
def create_transfer(data: TransferCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return transfer_service.create_transfer(db, current_user.id, data)
