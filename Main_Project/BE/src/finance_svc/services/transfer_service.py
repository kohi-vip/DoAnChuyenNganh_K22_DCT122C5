from sqlalchemy.orm import Session
from fastapi import HTTPException
from finance_svc.models.transfer import Transfer
from finance_svc.models.wallet import Wallet
from finance_svc.schemas.transfer import TransferCreate, TransferResponse
import uuid


def create_transfer(db: Session, user_id: str, data: TransferCreate) -> TransferResponse:
    if data.from_wallet_id == data.to_wallet_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same wallet")

    from_wallet = db.query(Wallet).filter(
        Wallet.id == data.from_wallet_id, Wallet.user_id == user_id
    ).with_for_update().first()
    to_wallet = db.query(Wallet).filter(
        Wallet.id == data.to_wallet_id, Wallet.user_id == user_id
    ).with_for_update().first()

    if not from_wallet:
        raise HTTPException(status_code=404, detail="Source wallet not found")
    if not to_wallet:
        raise HTTPException(status_code=404, detail="Destination wallet not found")
    if from_wallet.balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    transfer = Transfer(
        id=str(uuid.uuid4()),
        from_wallet_id=data.from_wallet_id,
        to_wallet_id=data.to_wallet_id,
        amount=data.amount,
        note=data.note,
    )
    db.add(transfer)
    from_wallet.balance -= data.amount
    to_wallet.balance += data.amount
    db.commit()
    db.refresh(transfer)
    return TransferResponse.model_validate(transfer)


def list_transfers(db: Session, user_id: str) -> list[TransferResponse]:
    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    transfers = db.query(Transfer).filter(
        (Transfer.from_wallet_id.in_(wallet_ids)) | (Transfer.to_wallet_id.in_(wallet_ids))
    ).order_by(Transfer.transferred_at.desc()).all()
    return [TransferResponse.model_validate(t) for t in transfers]
