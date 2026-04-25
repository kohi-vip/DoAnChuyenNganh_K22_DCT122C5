import calendar
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from fastapi import HTTPException
from finance_svc.models.recurring_transaction import RecurringTransaction
from finance_svc.models.wallet import Wallet
from finance_svc.models.transaction import Transaction
from finance_svc.models.notification import Notification
from finance_svc.schemas.recurring import RecurringCreate, RecurringUpdate, RecurringResponse
import uuid


VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _vn_now() -> datetime:
    return datetime.now(VN_TZ).replace(tzinfo=None)


def create_recurring(db: Session, user_id: str, data: RecurringCreate) -> RecurringResponse:
    wallet = db.query(Wallet).filter(Wallet.id == data.wallet_id, Wallet.user_id == user_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    effective_start_date = data.start_date or data.next_due_date
    effective_next_due_date = data.next_due_date or data.start_date
    if effective_next_due_date < effective_start_date:
        raise HTTPException(status_code=422, detail="Ngày bắt đầu kỳ đầu phải lớn hơn hoặc bằng ngày bắt đầu")
    if data.end_date and effective_next_due_date and data.end_date < effective_next_due_date:
        raise HTTPException(status_code=422, detail="Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu kỳ đầu")

    rec = RecurringTransaction(
        id=str(uuid.uuid4()),
        wallet_id=data.wallet_id,
        category_id=data.category_id,
        type=data.type,
        amount=data.amount,
        note=data.note,
        frequency=data.frequency,
        start_date=effective_start_date,
        next_due_date=effective_next_due_date,
        execution_time=data.execution_time,
        end_date=data.end_date,
        notification_enabled=data.notification_enabled,
        remind_before_minutes=data.remind_before_minutes,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return RecurringResponse.model_validate(rec)


def list_recurring(db: Session, user_id: str) -> list[RecurringResponse]:
    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    recs = db.query(RecurringTransaction).filter(RecurringTransaction.wallet_id.in_(wallet_ids)).all()
    has_legacy_updates = False
    for rec in recs:
        has_legacy_updates = _normalize_legacy_fields(rec) or has_legacy_updates
    if has_legacy_updates:
        db.commit()
    return [RecurringResponse.model_validate(r) for r in recs]


def update_recurring(db: Session, user_id: str, rec_id: str, data: RecurringUpdate) -> RecurringResponse:
    rec = _get_or_404(db, user_id, rec_id)

    start_date = data.start_date or rec.start_date
    next_due_date = data.next_due_date or rec.next_due_date
    end_date = data.end_date if data.end_date is not None else rec.end_date
    if next_due_date < start_date:
        raise HTTPException(status_code=422, detail="Ngày bắt đầu kỳ đầu phải lớn hơn hoặc bằng ngày bắt đầu")
    if end_date and end_date < max(start_date, next_due_date):
        raise HTTPException(status_code=422, detail="Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu kỳ đầu")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(rec, field, value)
    db.commit()
    db.refresh(rec)
    return RecurringResponse.model_validate(rec)


def pay_now_recurring(db: Session, user_id: str, rec_id: str) -> RecurringResponse:
    rec = _get_or_404(db, user_id, rec_id)
    if not rec.is_active:
        raise HTTPException(status_code=422, detail="Recurring transaction is not active")

    today = _vn_now().date()
    if rec.end_date and today > rec.end_date:
        raise HTTPException(status_code=422, detail="Recurring transaction has ended")

    wallet = db.query(Wallet).filter(Wallet.id == rec.wallet_id).with_for_update().first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    _create_transaction_from_recurring(db, rec, wallet, today, source="manual")

    base_due_date = rec.next_due_date or today
    rec.next_due_date = _next_date(base_due_date, rec.frequency)
    if rec.end_date and rec.next_due_date > rec.end_date:
        rec.is_active = False

    db.commit()
    db.refresh(rec)
    return RecurringResponse.model_validate(rec)


def delete_recurring(db: Session, user_id: str, rec_id: str):
    rec = _get_or_404(db, user_id, rec_id)
    db.delete(rec)
    db.commit()


def process_due_recurring(db: Session):
    now = _vn_now()
    today = now.date()
    _queue_due_reminders(db, now)

    due = db.query(RecurringTransaction).filter(
        RecurringTransaction.is_active == True,
        RecurringTransaction.next_due_date <= today,
    ).all()

    for rec in due:
        if rec.end_date and today > rec.end_date:
            rec.is_active = False
            continue

        due_at = datetime.combine(rec.next_due_date, rec.execution_time)
        if due_at > now:
            continue

        if _has_manual_payment_in_cycle(db, rec, due_at):
            rec.next_due_date = _next_date(rec.next_due_date, rec.frequency)
            if rec.end_date and rec.next_due_date > rec.end_date:
                rec.is_active = False
            continue

        notification_type = "overdue" if rec.next_due_date < today else "due"
        _create_notification_if_absent(
            db,
            rec,
            notification_type,
            due_at,
            title="Đến hạn giao dịch định kỳ",
            message=f"{rec.note or 'Giao dịch định kỳ'} đã đến hạn thanh toán.",
        )

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
        last_day = calendar.monthrange(year, month)[1]
        day = min(from_date.day, last_day)
        return date(year, month, day)
    elif frequency == "yearly":
        year = from_date.year + 1
        if from_date.month == 2 and from_date.day == 29 and not calendar.isleap(year):
            return date(year, 2, 28)
        return date(year, from_date.month, from_date.day)
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


def _create_transaction_from_recurring(
    db: Session,
    rec: RecurringTransaction,
    wallet: Wallet,
    transacted_on: date,
    source: str = "auto_sync",
):
    txn = Transaction(
        id=str(uuid.uuid4()),
        wallet_id=rec.wallet_id,
        category_id=rec.category_id,
        recurring_id=rec.id,
        type=rec.type,
        amount=rec.amount,
        note=rec.note,
        transacted_at=datetime.combine(transacted_on, rec.execution_time),
        source=source,
        is_reviewed=True,
    )
    db.add(txn)
    if rec.type == "income":
        wallet.balance += rec.amount
    else:
        wallet.balance -= rec.amount


def _queue_due_reminders(db: Session, now: datetime):
    reminder_candidates = db.query(RecurringTransaction).filter(
        RecurringTransaction.is_active == True,
        RecurringTransaction.notification_enabled == True,
        RecurringTransaction.next_due_date <= now.date(),
    ).all()

    for rec in reminder_candidates:
        scheduled_due = datetime.combine(rec.next_due_date, rec.execution_time)
        reminder_at = scheduled_due - timedelta(minutes=rec.remind_before_minutes)
        if reminder_at > now:
            continue
        _create_notification_if_absent(
            db,
            rec,
            "reminder",
            reminder_at,
            title="Nhắc thanh toán giao dịch định kỳ",
            message=f"{rec.note or 'Giao dịch định kỳ'} sẽ đến hạn lúc {rec.execution_time.strftime('%H:%M')}.",
        )


def _create_notification_if_absent(
    db: Session,
    rec: RecurringTransaction,
    notification_type: str,
    scheduled_for: datetime,
    title: str,
    message: str,
):
    wallet = db.query(Wallet).filter(Wallet.id == rec.wallet_id).first()
    if not wallet:
        return

    exists = db.query(Notification).filter(
        Notification.recurring_id == rec.id,
        Notification.notification_type == notification_type,
        Notification.scheduled_for == scheduled_for,
    ).first()
    if exists:
        return

    db.add(
        Notification(
            id=str(uuid.uuid4()),
            user_id=wallet.user_id,
            recurring_id=rec.id,
            title=title,
            message=message,
            notification_type=notification_type,
            scheduled_for=scheduled_for,
            is_read=False,
        )
    )
    rec.last_notified_at = _vn_now()


def _has_manual_payment_in_cycle(db: Session, rec: RecurringTransaction, due_at: datetime) -> bool:
    cycle_start = due_at - timedelta(minutes=rec.remind_before_minutes or 0)
    cycle_end = datetime.combine(_next_date(rec.next_due_date, rec.frequency), rec.execution_time)
    existing = (
        db.query(Transaction.id)
        .filter(
            Transaction.recurring_id == rec.id,
            Transaction.source != "auto_sync",
            Transaction.transacted_at >= cycle_start,
            Transaction.transacted_at < cycle_end,
        )
        .first()
    )
    return existing is not None


def _normalize_legacy_fields(rec: RecurringTransaction) -> bool:
    changed = False

    if rec.start_date is None:
        rec.start_date = rec.next_due_date or _vn_now().date()
        changed = True

    if rec.execution_time is None:
        rec.execution_time = datetime.strptime("08:00", "%H:%M").time()
        changed = True

    if rec.remind_before_minutes is None:
        rec.remind_before_minutes = 30
        changed = True

    if rec.notification_enabled is None:
        rec.notification_enabled = True
        changed = True

    return changed
