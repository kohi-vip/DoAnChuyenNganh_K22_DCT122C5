from datetime import date, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException
from finance_svc.models.recurring_transaction import RecurringTransaction
from finance_svc.models.wallet import Wallet
from finance_svc.models.transaction import Transaction
from finance_svc.schemas.recurring import RecurringCreate, RecurringUpdate, RecurringResponse
import uuid


def create_recurring(db: Session, user_id: str, data: RecurringCreate) -> RecurringResponse:
    wallet = db.query(Wallet).filter(Wallet.id == data.wallet_id, Wallet.user_id == user_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    rec = RecurringTransaction(
        id=str(uuid.uuid4()),
        wallet_id=data.wallet_id,
        category_id=data.category_id,
        type=data.type,
        amount=data.amount,
        note=data.note,
        frequency=data.frequency,
        next_due_date=data.next_due_date,
        end_date=data.end_date,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return RecurringResponse.model_validate(rec)


def list_recurring(db: Session, user_id: str) -> list[RecurringResponse]:
    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    recs = db.query(RecurringTransaction).filter(RecurringTransaction.wallet_id.in_(wallet_ids)).all()
    return [RecurringResponse.model_validate(r) for r in recs]


def update_recurring(db: Session, user_id: str, rec_id: str, data: RecurringUpdate) -> RecurringResponse:
    rec = _get_or_404(db, user_id, rec_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(rec, field, value)
    db.commit()
    db.refresh(rec)
    return RecurringResponse.model_validate(rec)


def delete_recurring(db: Session, user_id: str, rec_id: str):
    rec = _get_or_404(db, user_id, rec_id)
    db.delete(rec)
    db.commit()


def process_due_recurring(db: Session):
    """Called by scheduler daily at 7:00 AM"""
    today = date.today()
    due = db.query(RecurringTransaction).filter(
        RecurringTransaction.is_active == True,
        RecurringTransaction.next_due_date <= today,
    ).all()

    for rec in due:
        if rec.end_date and today > rec.end_date:
            rec.is_active = False
            continue
        wallet = db.query(Wallet).filter(Wallet.id == rec.wallet_id).with_for_update().first()
        if not wallet:
            continue
        txn = Transaction(
            id=str(uuid.uuid4()),
            wallet_id=rec.wallet_id,
            category_id=rec.category_id,
            recurring_id=rec.id,
            type=rec.type,
            amount=rec.amount,
            note=rec.note,
            transacted_at=today,
            source="manual",
            is_reviewed=True,
        )
        db.add(txn)
        if rec.type == "income":
            wallet.balance += rec.amount
        else:
            wallet.balance -= rec.amount
        rec.next_due_date = _next_date(today, rec.frequency)

    db.commit()


def _next_date(from_date: date, frequency: str) -> date:
    if frequency == "daily":
        return from_date + timedelta(days=1)
    elif frequency == "weekly":
        return from_date + timedelta(weeks=1)
    elif frequency == "monthly":
        month = from_date.month + 1
        year = from_date.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        return from_date.replace(year=year, month=month)
    elif frequency == "yearly":
        return from_date.replace(year=from_date.year + 1)
    return from_date + timedelta(days=1)


def _get_or_404(db: Session, user_id: str, rec_id: str) -> RecurringTransaction:
    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    rec = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == rec_id,
        RecurringTransaction.wallet_id.in_(wallet_ids),
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    return rec
