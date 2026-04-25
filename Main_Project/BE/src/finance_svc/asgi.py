from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from finance_svc.core.config import get_settings
from finance_svc.core.database import engine, SessionLocal
from finance_svc.models import *  # noqa: F401,F403 — registers all models with Base
from finance_svc.models.base import Base

from finance_svc.views import auth, wallets, categories, transactions, transfers, reports, recurring, ai, notifications

settings = get_settings()
scheduler = AsyncIOScheduler()


def _run_recurring_job():
    from finance_svc.services.recurring_service import process_due_recurring
    db: Session = SessionLocal()
    try:
        process_due_recurring(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    scheduler.add_job(_run_recurring_job, "interval", minutes=1, id="recurring_job")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Personal Finance Manager API",
    version="1.0.0",
    description="API for managing personal income, expenses, wallets, categories, transfers, reports and AI features.",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(wallets.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(transfers.router)
app.include_router(reports.router)
app.include_router(recurring.router)
app.include_router(notifications.router)
app.include_router(ai.router)


@app.get("/")
def root():
    return {"message": "Personal Finance Manager API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
