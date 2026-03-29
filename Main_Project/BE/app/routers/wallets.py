from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.utils.dependencies import get_current_user
from app.schemas.wallet import WalletCreate, WalletUpdate, WalletResponse
from app.services import wallet_service
from decimal import Decimal

router = APIRouter(prefix="/api/wallets", tags=["Wallets"])


@router.get("", response_model=list[WalletResponse])
def list_wallets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return wallet_service.get_wallets(db, current_user.id)


@router.post("", response_model=WalletResponse, status_code=201)
def create_wallet(data: WalletCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return wallet_service.create_wallet(db, current_user.id, data)


@router.get("/total-balance")
def total_balance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"total_balance": wallet_service.get_total_balance(db, current_user.id)}


@router.get("/{wallet_id}", response_model=WalletResponse)
def get_wallet(wallet_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return wallet_service.get_wallet(db, current_user.id, wallet_id)


@router.put("/{wallet_id}", response_model=WalletResponse)
def update_wallet(wallet_id: str, data: WalletUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return wallet_service.update_wallet(db, current_user.id, wallet_id, data)


@router.delete("/{wallet_id}", status_code=204)
def delete_wallet(wallet_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wallet_service.delete_wallet(db, current_user.id, wallet_id)
