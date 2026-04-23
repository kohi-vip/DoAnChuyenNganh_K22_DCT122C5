import csv
import io
import calendar
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException
from finance_svc.models.transaction import Transaction
from finance_svc.models.wallet import Wallet
from finance_svc.models.recurring_transaction import RecurringTransaction
from finance_svc.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse, TransactionListResponse
import uuid


def create_transaction(db: Session, user_id: str, data: TransactionCreate) -> TransactionResponse:
    wallet = db.query(Wallet).filter(
        Wallet.id == data.wallet_id, Wallet.user_id == user_id
    ).with_for_update().first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    recurring = None
    current_due = None
    cycle_end = None
    if data.recurring_id:
        recurring = db.query(RecurringTransaction).filter(RecurringTransaction.id == data.recurring_id).first()
        if not recurring:
            raise HTTPException(status_code=404, detail="Recurring transaction not found")
        if recurring.wallet_id != data.wallet_id:
            raise HTTPException(status_code=422, detail="Recurring transaction does not belong to selected wallet")

        current_due = recurring.next_due_date
        cycle_start = datetime.combine(current_due, time.min)
        if recurring.notification_enabled and recurring.remind_before_minutes:
            cycle_start = cycle_start - timedelta(minutes=recurring.remind_before_minutes)
        if data.transacted_at < cycle_start:
            raise HTTPException(status_code=422, detail="Kỳ giao dịch này chưa đến thời gian thanh toán")

        cycle_end = _next_date(current_due, recurring.frequency)
        paid_in_cycle = (
            db.query(Transaction.id)
            .filter(
                Transaction.recurring_id == recurring.id,
                Transaction.source != "auto_sync",
                Transaction.transacted_at >= cycle_start,
                Transaction.transacted_at < datetime.combine(cycle_end, time.min),
            )
            .first()
        )
        if paid_in_cycle:
            raise HTTPException(status_code=409, detail="Kỳ giao dịch này đã được thanh toán")

    txn = Transaction(
        id=str(uuid.uuid4()),
        wallet_id=data.wallet_id,
        category_id=data.category_id,
        recurring_id=data.recurring_id,
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

    if recurring and recurring.is_active:
        if current_due and cycle_end and data.transacted_at.date() >= current_due:
            recurring.next_due_date = cycle_end
            if recurring.end_date and recurring.next_due_date > recurring.end_date:
                recurring.is_active = False

    db.commit()
    db.refresh(txn)
    return TransactionResponse.model_validate(txn)


def _next_date(from_date: date, frequency: str) -> date:
    if frequency == "daily":
        return from_date + timedelta(days=1)
    if frequency == "weekly":
        return from_date + timedelta(weeks=1)
    if frequency == "monthly":
        month = from_date.month + 1
        year = from_date.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        last_day = calendar.monthrange(year, month)[1]
        day = min(from_date.day, last_day)
        return date(year, month, day)
    if frequency == "yearly":
        year = from_date.year + 1
        if from_date.month == 2 and from_date.day == 29 and not calendar.isleap(year):
            return date(year, 2, 28)
        return date(year, from_date.month, from_date.day)
    return from_date + timedelta(days=1)


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
