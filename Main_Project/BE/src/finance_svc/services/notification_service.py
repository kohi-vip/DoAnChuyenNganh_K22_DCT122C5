import math
import calendar
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from fastapi import HTTPException
from finance_svc.models.notification import Notification
from finance_svc.models.recurring_transaction import RecurringTransaction
from finance_svc.models.transaction import Transaction
from finance_svc.models.wallet import Wallet


VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _vn_now() -> datetime:
    return datetime.now(VN_TZ).replace(tzinfo=None)


def list_notifications(
    db: Session,
    user_id: str,
    page: int = 1,
    page_size: int = 20,
    is_read: bool | None = None,
):
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)

    total = query.count()
    items = (
        query.order_by(Notification.scheduled_for.desc(), Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    for item in items:
        item.is_paid = _is_notification_paid(db, item)
    total_pages = max(1, math.ceil(total / page_size)) if page_size > 0 else 1
    return items, total, total_pages


def get_unread_count(db: Session, user_id: str) -> int:
    return db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read == False).count()


def mark_as_read(db: Session, user_id: str, notification_id: str) -> Notification | None:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notification:
        return None
    notification.is_read = True
    notification.read_at = _vn_now()
    db.commit()
    db.refresh(notification)
    notification.is_paid = _is_notification_paid(db, notification)
    return notification


def mark_as_unread(db: Session, user_id: str, notification_id: str) -> Notification | None:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notification:
        return None
    notification.is_read = False
    notification.read_at = None
    db.commit()
    db.refresh(notification)
    notification.is_paid = _is_notification_paid(db, notification)
    return notification


def mark_all_as_read(db: Session, user_id: str) -> int:
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .update({
            Notification.is_read: True,
            Notification.read_at: _vn_now(),
        })
    )
    db.commit()
    return updated


def _is_notification_paid(db: Session, notification: Notification) -> bool:
    if not notification.recurring_id:
        return False

    recurring = db.query(RecurringTransaction).filter(RecurringTransaction.id == notification.recurring_id).first()
    if not recurring:
        return False

    cycle_start, cycle_end = _resolve_cycle_bounds(notification, recurring)

    paid_txn = (
        db.query(Transaction.id)
        .filter(
            Transaction.recurring_id == notification.recurring_id,
            Transaction.source != "auto_sync",
            Transaction.transacted_at >= cycle_start,
            Transaction.transacted_at < cycle_end,
        )
        .first()
    )
    return paid_txn is not None


def _resolve_cycle_bounds(notification: Notification, recurring: RecurringTransaction) -> tuple[datetime, datetime]:
    remind_minutes = recurring.remind_before_minutes or 0
    if notification.notification_type == "reminder":
        due_at = notification.scheduled_for + timedelta(minutes=remind_minutes)
    else:
        due_at = notification.scheduled_for

    cycle_start = due_at - timedelta(minutes=remind_minutes)
    next_due = _next_date(due_at.date(), recurring.frequency)
    cycle_end = datetime.combine(next_due, recurring.execution_time)
    return cycle_start, cycle_end


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
        return date(year, month, min(from_date.day, last_day))
    if frequency == "yearly":
        year = from_date.year + 1
        if from_date.month == 2 and from_date.day == 29 and not calendar.isleap(year):
            return date(year, 2, 28)
        return date(year, from_date.month, from_date.day)
    return from_date + timedelta(days=1)


def handle_notification_action(db: Session, user_id: str, notification_id: str, action: str) -> dict:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notification.recurring_id:
        raise HTTPException(status_code=422, detail="Notification has no associated recurring transaction")

    recurring = db.query(RecurringTransaction).filter(RecurringTransaction.id == notification.recurring_id).first()
    if not recurring:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")

    wallet = db.query(Wallet).filter(Wallet.id == recurring.wallet_id).with_for_update().first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    if action == "dismiss":
        action = "skip"

    cycle_start, cycle_end = _resolve_cycle_bounds(notification, recurring)
    due_at = _resolve_due_at(notification, recurring)
    result = {"action": action, "notification_id": notification_id}

    if action == "pay":
        if not _has_manual_payment_in_cycle(db, recurring.id, cycle_start, cycle_end):
            txn = Transaction(
                id=str(uuid.uuid4()),
                wallet_id=recurring.wallet_id,
                category_id=recurring.category_id,
                recurring_id=recurring.id,
                type=recurring.type,
                amount=recurring.amount,
                note=recurring.note,
                transacted_at=_vn_now(),
                source="manual",
                is_reviewed=True,
            )
            db.add(txn)
            if recurring.type == "income":
                wallet.balance += recurring.amount
            else:
                wallet.balance -= recurring.amount
            result["transaction_id"] = txn.id

    elif action == "skip":
        pass

    else:
        raise HTTPException(status_code=422, detail=f"Invalid action: {action}")

    if action in ["pay", "skip"]:
        _advance_cycle_if_needed(recurring, due_at.date())
        _delete_cycle_notifications(db, user_id, recurring.id, cycle_start, cycle_end)

    db.commit()

    return result


def _resolve_due_at(notification: Notification, recurring: RecurringTransaction) -> datetime:
    remind_minutes = recurring.remind_before_minutes or 0
    if notification.notification_type == "reminder":
        return notification.scheduled_for + timedelta(minutes=remind_minutes)
    return notification.scheduled_for


def _has_manual_payment_in_cycle(
    db: Session,
    recurring_id: str,
    cycle_start: datetime,
    cycle_end: datetime,
) -> bool:
    paid_txn = (
        db.query(Transaction.id)
        .filter(
            Transaction.recurring_id == recurring_id,
            Transaction.source != "auto_sync",
            Transaction.transacted_at >= cycle_start,
            Transaction.transacted_at < cycle_end,
        )
        .first()
    )
    return paid_txn is not None


def _advance_cycle_if_needed(recurring: RecurringTransaction, cycle_due_date: date):
    if recurring.next_due_date <= cycle_due_date:
        recurring.next_due_date = _next_date(cycle_due_date, recurring.frequency)
    if recurring.end_date and recurring.next_due_date > recurring.end_date:
        recurring.is_active = False


def _delete_cycle_notifications(
    db: Session,
    user_id: str,
    recurring_id: str,
    cycle_start: datetime,
    cycle_end: datetime,
):
    cycle_notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.recurring_id == recurring_id,
            Notification.scheduled_for >= cycle_start,
            Notification.scheduled_for < cycle_end,
        )
        .all()
    )
    for item in cycle_notifications:
        db.delete(item)
