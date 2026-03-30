from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from finance_svc.models.transaction import Transaction
from finance_svc.models.wallet import Wallet
from finance_svc.models.category import Category
from finance_svc.schemas.report import (
    SummaryResponse, CategoryBreakdown, CategoryReportResponse,
    TrendPoint, TrendResponse, CompareResponse,
)


def _user_wallet_ids(db: Session, user_id: str) -> list[str]:
    return [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]


def _base_query(db: Session, user_id: str):
    wallet_ids = _user_wallet_ids(db, user_id)
    return db.query(Transaction).filter(
        Transaction.wallet_id.in_(wallet_ids),
        Transaction.is_reviewed == True,
    )


def get_summary(db: Session, user_id: str, month: int, year: int) -> SummaryResponse:
    q = _base_query(db, user_id).filter(
        extract("month", Transaction.transacted_at) == month,
        extract("year", Transaction.transacted_at) == year,
    )
    income = q.filter(Transaction.type == "income").with_entities(func.sum(Transaction.amount)).scalar() or Decimal("0")
    expense = q.filter(Transaction.type == "expense").with_entities(func.sum(Transaction.amount)).scalar() or Decimal("0")
    saving_rate = float((income - expense) / income * 100) if income > 0 else None
    return SummaryResponse(
        total_income=income,
        total_expense=expense,
        balance=income - expense,
        saving_rate=saving_rate,
    )


def get_by_category(db: Session, user_id: str, month: int, year: int) -> CategoryReportResponse:
    wallet_ids = _user_wallet_ids(db, user_id)
    rows = (
        db.query(Category.id, Category.name, func.sum(Transaction.amount).label("total"))
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.wallet_id.in_(wallet_ids),
            Transaction.is_reviewed == True,
            Transaction.type == "expense",
            extract("month", Transaction.transacted_at) == month,
            extract("year", Transaction.transacted_at) == year,
        )
        .group_by(Category.id, Category.name)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )
    total = sum(r.total for r in rows) or Decimal("1")
    items = [
        CategoryBreakdown(
            category_id=r.id,
            category_name=r.name,
            amount=r.total,
            percentage=round(float(r.total / total * 100), 2),
        )
        for r in rows
    ]
    return CategoryReportResponse(period=f"{year}-{month:02d}", items=items)


def get_trend(db: Session, user_id: str, months: int) -> TrendResponse:
    wallet_ids = _user_wallet_ids(db, user_id)
    rows = (
        db.query(
            extract("year", Transaction.transacted_at).label("year"),
            extract("month", Transaction.transacted_at).label("month"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        )
        .filter(
            Transaction.wallet_id.in_(wallet_ids),
            Transaction.is_reviewed == True,
        )
        .group_by("year", "month", Transaction.type)
        .order_by("year", "month")
        .all()
    )
    data: dict[str, dict] = {}
    for r in rows:
        key = f"{int(r.year)}-{int(r.month):02d}"
        if key not in data:
            data[key] = {"income": Decimal("0"), "expense": Decimal("0")}
        data[key][r.type] += r.total

    points = [
        TrendPoint(
            period=k,
            income=v["income"],
            expense=v["expense"],
            balance=v["income"] - v["expense"],
        )
        for k, v in sorted(data.items())[-months:]
    ]
    return TrendResponse(points=points)


def get_compare(db: Session, user_id: str, month1: int, month2: int, year: int) -> CompareResponse:
    def _period_totals(month: int):
        q = _base_query(db, user_id).filter(
            extract("month", Transaction.transacted_at) == month,
            extract("year", Transaction.transacted_at) == year,
        )
        inc = q.filter(Transaction.type == "income").with_entities(func.sum(Transaction.amount)).scalar() or Decimal("0")
        exp = q.filter(Transaction.type == "expense").with_entities(func.sum(Transaction.amount)).scalar() or Decimal("0")
        return inc, exp

    i1, e1 = _period_totals(month1)
    i2, e2 = _period_totals(month2)
    return CompareResponse(
        period1=f"{year}-{month1:02d}",
        period2=f"{year}-{month2:02d}",
        income1=i1, income2=i2,
        expense1=e1, expense2=e2,
        balance1=i1 - e1, balance2=i2 - e2,
    )
