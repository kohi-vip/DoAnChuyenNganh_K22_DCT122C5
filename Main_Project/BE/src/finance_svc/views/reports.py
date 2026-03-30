from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from finance_svc.core.database import get_db
from finance_svc.models.user import User
from finance_svc.dependencies import get_current_user
from finance_svc.schemas.report import SummaryResponse, CategoryReportResponse, TrendResponse, CompareResponse
from finance_svc.services import report_service
from datetime import datetime

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/summary", response_model=SummaryResponse)
def summary(
    month: int = Query(default=datetime.now().month, ge=1, le=12),
    year: int = Query(default=datetime.now().year, ge=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return report_service.get_summary(db, current_user.id, month, year)


@router.get("/by-category", response_model=CategoryReportResponse)
def by_category(
    month: int = Query(default=datetime.now().month, ge=1, le=12),
    year: int = Query(default=datetime.now().year, ge=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return report_service.get_by_category(db, current_user.id, month, year)


@router.get("/trend", response_model=TrendResponse)
def trend(
    months: int = Query(default=6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return report_service.get_trend(db, current_user.id, months)


@router.get("/compare", response_model=CompareResponse)
def compare(
    month1: int = Query(ge=1, le=12),
    month2: int = Query(ge=1, le=12),
    year: int = Query(default=datetime.now().year, ge=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return report_service.get_compare(db, current_user.id, month1, month2, year)
