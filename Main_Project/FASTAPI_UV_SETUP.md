# FastAPI + uv — Hướng dẫn tổ chức dự án Backend (src layout)

> Tài liệu này hướng dẫn dùng `uv` thay thế `pip + venv`,
> tổ chức file theo **src layout** (chuẩn Python packaging hiện đại),
> áp dụng vào dự án quản lý chi tiêu cá nhân.

---

## 1. Tại sao dùng `uv` thay vì `pip`?

| Vấn đề với `pip + venv` | Giải pháp với `uv` |
|---|---|
| Phải tự tạo venv, tự activate | `uv` tự quản lý venv hoàn toàn |
| `requirements.txt` không lock version chính xác | `uv.lock` lock toàn bộ dependency tree |
| Cài package chậm | Viết bằng Rust — nhanh hơn pip 10–100x |
| Khác máy cài ra môi trường khác | `uv sync` đảm bảo mọi người có cùng môi trường |
| Quản lý Python version phức tạp | `uv` tự cài và quản lý Python version |

---

## 2. Tại sao dùng `src` layout?

Cấu trúc thông thường đặt package thẳng ở root:
```
finance-app/
├── finance_svc/    ← package nằm ở root
└── tests/
```

`src` layout đặt package bên trong thư mục `src/`:
```
finance-app/
├── src/
│   └── finance_svc/    ← package nằm trong src/
└── tests/
```

**Lợi ích của `src` layout:**

- Tránh import nhầm — Python không vô tình import code local thay vì package đã cài
- Buộc phải cài package qua `uv` trước khi chạy → phát hiện lỗi thiếu dependency sớm
- Chuẩn packaging của PyPA (Python Packaging Authority)
- Tests chạy đúng môi trường installed, không phụ thuộc vị trí chạy lệnh

---

## 3. Cài đặt `uv`

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Kiểm tra
uv --version
```

---

## 4. Khởi tạo dự án với src layout

```bash
# Tạo thư mục và init project
mkdir finance-app-backend
cd finance-app-backend

# --app --package tạo ra src layout ngay từ đầu
uv init --app --package
```

---

## 5. Cấu trúc thư mục đầy đủ

```
finance-app-backend/
│
├── .gitignore
├── .python-version          ← "3.12"
├── .env                     ← biến môi trường (KHÔNG commit git)
├── .env.example             ← template .env (commit git)
├── pyproject.toml           ← dependencies + metadata + build config
├── uv.lock                  ← lock file (PHẢI commit git)
├── alembic.ini
│
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 001_init_tables.py
│
├── src/
│   └── finance_svc/         ← tên package = tên service
│       ├── __init__.py
│       │
│       ├── asgi.py          ← entry point (thay thế main.py)
│       │
│       ├── core/
│       │   ├── __init__.py
│       │   ├── config.py    ← đọc biến môi trường
│       │   ├── security.py  ← JWT, bcrypt
│       │   └── database.py  ← SQLAlchemy engine + session
│       │
│       ├── models/          ← SQLAlchemy ORM models
│       │   ├── __init__.py
│       │   ├── base.py
│       │   ├── user.py
│       │   ├── wallet.py
│       │   ├── category.py
│       │   ├── transaction.py
│       │   ├── transfer.py
│       │   └── recurring_transaction.py
│       │
│       ├── schemas/         ← Pydantic schemas
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   ├── wallet.py
│       │   ├── category.py
│       │   ├── transaction.py
│       │   ├── transfer.py
│       │   └── report.py
│       │
│       ├── services/        ← Business logic
│       │   ├── __init__.py
│       │   ├── auth_service.py
│       │   ├── wallet_service.py
│       │   ├── category_service.py
│       │   ├── transaction_service.py
│       │   ├── transfer_service.py
│       │   ├── report_service.py
│       │   ├── ai_service.py
│       │   └── ocr_service.py
│       │
│       ├── views/           ← API endpoints (thay thế routers/)
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   ├── wallets.py
│       │   ├── categories.py
│       │   ├── transactions.py
│       │   ├── transfers.py
│       │   ├── reports.py
│       │   └── ai.py
│       │
│       └── dependencies.py  ← get_db, get_current_user
│
└── tests/
    ├── __init__.py
    ├── conftest.py
    └── test_e2e.py
```

> **Tại sao `views/` thay vì `routers/`?**
> Cả hai đều dùng `APIRouter` bên trong — chỉ là tên convention khác nhau.
> `views` nhấn mạnh tầng này chỉ nhận/trả request, không chứa logic nghiệp vụ.

---

## 6. Nội dung các file cốt lõi

### `pyproject.toml`

```toml
[project]
name = "finance-svc"
version = "0.1.0"
description = "Personal Finance Manager API"
requires-python = ">=3.12"
dependencies = [
    "fastapi[standard]>=0.115.0",
    "sqlalchemy>=2.0.35",
    "alembic>=1.13.3",
    "pymysql>=1.1.1",
    "pydantic-settings>=2.5.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "python-multipart>=0.0.12",
    "groq>=0.11.0",
    "veryfi>=9.0.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "httpx>=0.27.0",
    "pytest-asyncio>=0.24.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

# Khai báo src layout — quan trọng để uv tìm đúng package
[tool.hatch.build.targets.wheel]
packages = ["src/finance_svc"]
```

---

### `src/finance_svc/asgi.py` — Entry point

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from finance_svc.core.config import settings
from finance_svc.views import auth, wallets, categories, transactions, transfers, reports, ai

app = FastAPI(
    title="Finance App API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,         prefix="/api")
app.include_router(wallets.router,      prefix="/api")
app.include_router(categories.router,   prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(transfers.router,    prefix="/api")
app.include_router(reports.router,      prefix="/api")
app.include_router(ai.router,           prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok"}
```

---

### `src/finance_svc/core/config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    GROQ_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    VERYFI_CLIENT_ID: str = ""
    VERYFI_CLIENT_SECRET: str = ""
    VERYFI_USERNAME: str = ""
    VERYFI_API_KEY: str = ""

    APP_ENV: str = "development"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
```

---

### `src/finance_svc/core/database.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from finance_svc.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.APP_ENV == "development",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

### `src/finance_svc/models/base.py`

```python
import uuid
from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

def generate_uuid() -> str:
    return str(uuid.uuid4())
```

---

### `src/finance_svc/models/user.py`

```python
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from finance_svc.models.base import Base, TimestampMixin, generate_uuid

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(100))
    default_currency: Mapped[str] = mapped_column(String(10), default="VND")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    wallets: Mapped[list["Wallet"]] = relationship(back_populates="user")
    categories: Mapped[list["Category"]] = relationship(back_populates="user")
```

---

### `src/finance_svc/views/transactions.py` — Ví dụ view

```python
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from finance_svc.dependencies import get_db, get_current_user
from finance_svc.models.user import User
from finance_svc.schemas.transaction import TransactionCreate, TransactionResponse
from finance_svc.services import transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions"])

@router.get("/", response_model=list[TransactionResponse])
def list_transactions(
    wallet_id: str | None = Query(None),
    category_id: str | None = Query(None),
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return transaction_service.list_transactions(
        db, current_user.id, wallet_id, category_id, type, page, limit
    )

@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return transaction_service.create_transaction(db, payload, current_user.id)

@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return transaction_service.get_transaction(db, transaction_id, current_user.id)

@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: str,
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return transaction_service.update_transaction(db, transaction_id, payload, current_user.id)

@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction_service.delete_transaction(db, transaction_id, current_user.id)
```

---

### `src/finance_svc/services/transaction_service.py`

```python
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException
from finance_svc.models.transaction import Transaction
from finance_svc.models.wallet import Wallet
from finance_svc.schemas.transaction import TransactionCreate

def create_transaction(db: Session, payload: TransactionCreate, user_id: str) -> Transaction:
    """
    Tạo giao dịch + cập nhật balance ví trong cùng 1 DB transaction.
    with_for_update() lock row — tránh race condition.
    """
    wallet = db.execute(
        select(Wallet)
        .where(Wallet.id == payload.wallet_id, Wallet.user_id == user_id)
        .with_for_update()
    ).scalar_one_or_none()

    if not wallet:
        raise HTTPException(status_code=404, detail="Ví không tồn tại")

    txn = Transaction(
        wallet_id=payload.wallet_id,
        category_id=payload.category_id,
        type=payload.type,
        amount=payload.amount,
        currency=payload.currency,
        note=payload.note,
        transacted_at=payload.transacted_at,
        source="manual",
    )

    if payload.type == "expense":
        wallet.balance -= payload.amount
    else:
        wallet.balance += payload.amount

    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn
```

---

### `src/finance_svc/dependencies.py`

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from finance_svc.core.database import get_db
from finance_svc.core.security import decode_access_token
from finance_svc.models.user import User

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    user_id = decode_access_token(token)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn",
        )

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản không tồn tại",
        )
    return user
```

---

### `tests/test_e2e.py`

```python
from fastapi.testclient import TestClient
from finance_svc.asgi import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_register_and_login():
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "password123",
        "full_name": "Test User",
    })
    assert response.status_code == 201

    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "password123",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()
```

---

## 7. Quản lý dependencies với `uv`

```bash
# Thêm package
uv add fastapi[standard]
uv add sqlalchemy alembic pymysql pydantic-settings
uv add python-jose[cryptography] passlib[bcrypt] python-multipart
uv add groq veryfi

# Dev dependencies
uv add --dev pytest httpx pytest-asyncio

# Cài từ lock file (sau khi clone)
uv sync

# Xóa package
uv remove ten-package
```

| Tác vụ | pip (cũ) | uv (mới) |
|---|---|---|
| Cài package | `pip install fastapi` | `uv add fastapi` |
| Gỡ package | `pip uninstall fastapi` | `uv remove fastapi` |
| Cài từ lock | `pip install -r requirements.txt` | `uv sync` |
| Chạy lệnh | `source .venv/bin/activate && python` | `uv run python` |

---

## 8. Chạy ứng dụng

```bash
# Dev — hot reload
uv run fastapi dev src/finance_svc/asgi.py

# Production
uv run fastapi run src/finance_svc/asgi.py

# Uvicorn trực tiếp (dùng module path, dấu chấm không phải slash)
uv run uvicorn finance_svc.asgi:app --reload --host 0.0.0.0 --port 8000
```

> **Quan trọng:** Với src layout, import trong code dùng tên package (`finance_svc.xxx`),
> không phải đường dẫn file (`src/finance_svc/xxx`).

---

## 9. Alembic Migration

```bash
# Khởi tạo (1 lần)
uv run alembic init alembic
```

Sửa `alembic/env.py` để nhận diện đúng models từ src layout:

```python
# alembic/env.py — thêm phần này vào đầu file
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from finance_svc.core.config import settings
from finance_svc.models.base import Base
# Import tất cả models để alembic phát hiện thay đổi
from finance_svc.models import (
    user, wallet, category,
    transaction, transfer, recurring_transaction
)

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
target_metadata = Base.metadata
```

```bash
# Tạo migration sau khi thêm/sửa model
uv run alembic revision --autogenerate -m "create initial tables"

# Áp dụng
uv run alembic upgrade head

# Rollback
uv run alembic downgrade -1

# Xem lịch sử
uv run alembic history
```

---

## 10. File môi trường

### `.env` (KHÔNG commit git)

```bash
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/finance_app

SECRET_KEY=change-this-to-random-string-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

GROQ_API_KEY=gsk_xxxxxxxxxxxx
GOOGLE_API_KEY=AIzaSyxxxxxxx

VERYFI_CLIENT_ID=xxxxx
VERYFI_CLIENT_SECRET=xxxxx
VERYFI_USERNAME=xxxxx
VERYFI_API_KEY=xxxxx

APP_ENV=development
CORS_ORIGINS=["http://localhost:5173"]
```

### `.env.example` (commit git)

```bash
DATABASE_URL=mysql+pymysql://USER:PASSWORD@localhost:3306/finance_app
SECRET_KEY=REPLACE_WITH_RANDOM_STRING
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GROQ_API_KEY=
GOOGLE_API_KEY=
VERYFI_CLIENT_ID=
VERYFI_CLIENT_SECRET=
VERYFI_USERNAME=
VERYFI_API_KEY=
APP_ENV=development
CORS_ORIGINS=["http://localhost:5173"]
```

---

## 11. `.gitignore`

```
.env
.venv/
__pycache__/
*.pyc
.pytest_cache/
dist/
build/
*.egg-info/
```

---

## 12. Quy tắc viết code

**Luồng request:**
```
HTTP Request → views/ → services/ → SQLAlchemy DB
```

**Quy tắc cứng:**
1. `views/` không chứa logic — chỉ nhận payload, gọi service, trả response
2. Cập nhật `balance` phải trong cùng `db.commit()` với insert transaction
3. Dùng `with_for_update()` khi đọc wallet để cập nhật — tránh race condition
4. Tất cả endpoints phải có `response_model`
5. Không tự lưu kết quả AI — luôn trả FE xác nhận trước
6. `TRANSFER` không tính vào báo cáo thu chi

---

## 13. Chạy lần đầu — Checklist

```bash
# 1. Clone và cài dependencies
git clone <repo-url> && cd finance-app-backend
uv sync

# 2. Tạo .env
cp .env.example .env
# Điền DATABASE_URL và SECRET_KEY

# 3. Tạo database
mysql -u root -p -e "CREATE DATABASE finance_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. Migration
uv run alembic upgrade head

# 5. Chạy server
uv run fastapi dev src/finance_svc/asgi.py
# → http://localhost:8000/docs

# 6. Chạy tests
uv run pytest
```

---

## 14. Lệnh hay dùng hàng ngày

```bash
uv run fastapi dev src/finance_svc/asgi.py   # chạy server
uv add ten-package                            # thêm package
uv run alembic revision --autogenerate -m "..." # tạo migration
uv run alembic upgrade head                  # áp dụng migration
uv run pytest -v                             # chạy tests
```

---

## 15. Tóm tắt thay đổi so với app layout truyền thống

| | App layout (cũ) | Src layout (mới — theo video) |
|---|---|---|
| Package nằm ở | `app/` | `src/finance_svc/` |
| Entry point | `app/main.py` | `src/finance_svc/asgi.py` |
| Endpoints | `app/routers/` | `src/finance_svc/views/` |
| Import trong code | `from app.core.config` | `from finance_svc.core.config` |
| Chạy server | `fastapi dev app/main.py` | `fastapi dev src/finance_svc/asgi.py` |
| Import nhầm local? | Có thể xảy ra | Không — src layout ngăn chặn |

---

*Tổng hợp từ: official uv docs (astral.sh), FastAPI docs, Python Packaging Guide (PyPA). Cập nhật: 2025.*
