from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from finance_svc.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"charset": "utf8mb4"},
    pool_pre_ping=True,
    pool_recycle=300,
    echo=settings.app_env == "development",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
