import csv
import io
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException
from finance_svc.models.transaction import Transaction
from finance_svc.models.wallet import Wallet
from finance_svc.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse, TransactionListResponse
import uuid


def create_transaction(db: Session, user_id: str, data: TransactionCreate) -> TransactionResponse:
    wallet = db.query(Wallet).filter(
        Wallet.id == data.wallet_id, Wallet.user_id == user_id
    ).with_for_update().first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    txn = Transaction(
        id=str(uuid.uuid4()),
        wallet_id=data.wallet_id,
        category_id=data.category_id,
        type=data.type,
        amount=data.amount,
        currency=data.currency,
        note=data.note,
        transacted_at=data.transacted_at,
        receipt_url=data.receipt_url,
        source="manual",
        is_reviewed=True,
    )
    db.add(txn)
    if data.type == "income":
        wallet.balance += data.amount
    else:
        wallet.balance -= data.amount
    db.commit()
    db.refresh(txn)
    return TransactionResponse.model_validate(txn)


def list_transactions(
    db: Session,
    user_id: str,
    wallet_id: str | None,
    category_id: str | None,
    type: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    is_reviewed: bool | None,
    keyword: str | None,
    page: int,
    page_size: int,
) -> TransactionListResponse:
    user_wallet_ids = [
        w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()
    ]
    q = db.query(Transaction).filter(Transaction.wallet_id.in_(user_wallet_ids))

    if wallet_id:
        q = q.filter(Transaction.wallet_id == wallet_id)
    if category_id:
        q = q.filter(Transaction.category_id == category_id)
    if type:
        q = q.filter(Transaction.type == type)
    if date_from:
        q = q.filter(Transaction.transacted_at >= date_from)
    if date_to:
        q = q.filter(Transaction.transacted_at <= date_to)
    if is_reviewed is not None:
        q = q.filter(Transaction.is_reviewed == is_reviewed)
    if keyword:
        q = q.filter(Transaction.note.contains(keyword))

    total = q.count()
    items = q.order_by(Transaction.transacted_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size

    return TransactionListResponse(
        items=[TransactionResponse.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


def get_transaction(db: Session, user_id: str, transaction_id: str) -> TransactionResponse:
    txn = _get_or_404(db, user_id, transaction_id)
    return TransactionResponse.model_validate(txn)


def update_transaction(db: Session, user_id: str, transaction_id: str, data: TransactionUpdate) -> TransactionResponse:
    txn = _get_or_404(db, user_id, transaction_id)
    wallet = db.query(Wallet).filter(Wallet.id == txn.wallet_id).with_for_update().first()

    if txn.type == "income":
        wallet.balance -= txn.amount
    else:
        wallet.balance += txn.amount

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(txn, field, value)

    new_type = data.type or txn.type
    new_amount = data.amount or txn.amount
    if new_type == "income":
        wallet.balance += new_amount
    else:
        wallet.balance -= new_amount

    db.commit()
    db.refresh(txn)
    return TransactionResponse.model_validate(txn)


def delete_transaction(db: Session, user_id: str, transaction_id: str):
    txn = _get_or_404(db, user_id, transaction_id)
    wallet = db.query(Wallet).filter(Wallet.id == txn.wallet_id).with_for_update().first()
    if txn.type == "income":
        wallet.balance -= txn.amount
    else:
        wallet.balance += txn.amount
    db.delete(txn)
    db.commit()


def export_transactions_csv(
    db: Session,
    user_id: str,
    date_from: datetime | None,
    date_to: datetime | None,
) -> str:
    user_wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    q = db.query(Transaction).filter(Transaction.wallet_id.in_(user_wallet_ids), Transaction.is_reviewed == True)
    if date_from:
        q = q.filter(Transaction.transacted_at >= date_from)
    if date_to:
        q = q.filter(Transaction.transacted_at <= date_to)
    txns = q.order_by(Transaction.transacted_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Type", "Amount", "Currency", "Category", "Note", "Date", "Source"])
    for t in txns:
        writer.writerow([t.id, t.type, t.amount, t.currency, t.category_id or "", t.note or "", t.transacted_at.isoformat(), t.source])
    return output.getvalue()


def _get_or_404(db: Session, user_id: str, transaction_id: str) -> Transaction:
    user_wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    txn = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.wallet_id.in_(user_wallet_ids),
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn
