from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.wallet import Wallet
from app.schemas.wallet import WalletCreate, WalletUpdate, WalletResponse
import uuid


def get_wallets(db: Session, user_id: str) -> list[WalletResponse]:
    wallets = db.query(Wallet).filter(Wallet.user_id == user_id).all()
    return [WalletResponse.model_validate(w) for w in wallets]


def create_wallet(db: Session, user_id: str, data: WalletCreate) -> WalletResponse:
    wallet = Wallet(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=data.name,
        balance=data.initial_balance,
        currency=data.currency,
        icon=data.icon,
        color=data.color,
    )
    db.add(wallet)
    db.commit()
    db.refresh(wallet)
    return WalletResponse.model_validate(wallet)


def get_wallet(db: Session, user_id: str, wallet_id: str) -> WalletResponse:
    return WalletResponse.model_validate(_get_or_404(db, user_id, wallet_id))


def update_wallet(db: Session, user_id: str, wallet_id: str, data: WalletUpdate) -> WalletResponse:
    wallet = _get_or_404(db, user_id, wallet_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(wallet, field, value)
    db.commit()
    db.refresh(wallet)
    return WalletResponse.model_validate(wallet)


def delete_wallet(db: Session, user_id: str, wallet_id: str):
    wallet = _get_or_404(db, user_id, wallet_id)
    db.delete(wallet)
    db.commit()


def get_total_balance(db: Session, user_id: str) -> Decimal:
    wallets = db.query(Wallet).filter(Wallet.user_id == user_id, Wallet.is_active == True).all()
    return sum((w.balance for w in wallets), Decimal("0"))


def _get_or_404(db: Session, user_id: str, wallet_id: str) -> Wallet:
    w = db.query(Wallet).filter(Wallet.id == wallet_id, Wallet.user_id == user_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return w
