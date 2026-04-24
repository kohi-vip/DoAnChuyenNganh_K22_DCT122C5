import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finance_svc.asgi import app
from finance_svc.core.database import get_db
from finance_svc.models.base import Base
from finance_svc.models.user import User
from finance_svc.models.wallet import Wallet
from finance_svc.models.category import Category
from finance_svc.models.transaction import Transaction
from finance_svc.models.transfer import Transfer
from finance_svc.core.security import create_access_token


# ─── Test DB Setup ────────────────────────────────────────────────────────────

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_user(db):
    user = User(
        id=str(uuid.uuid4()),
        email="test@example.com",
        hashed_password="$2b$12$dummy",
        full_name="Test User",
        default_currency="VND",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers(test_user):
    token = create_access_token({"sub": test_user.id, "type": "access"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def test_wallet(db, test_user):
    wallet = Wallet(
        id=str(uuid.uuid4()),
        user_id=test_user.id,
        name="Test Wallet",
        balance=Decimal("1000000"),
        currency="VND",
        color="#2563eb",
        wallet_type="basic",
    )
    db.add(wallet)
    db.commit()
    db.refresh(wallet)
    return wallet


@pytest.fixture(scope="function")
def test_wallet_2(db, test_user):
    wallet = Wallet(
        id=str(uuid.uuid4()),
        user_id=test_user.id,
        name="Test Wallet 2",
        balance=Decimal("500000"),
        currency="VND",
        color="#10b981",
        wallet_type="basic",
    )
    db.add(wallet)
    db.commit()
    db.refresh(wallet)
    return wallet


@pytest.fixture(scope="function")
def test_category(db, test_user):
    category = Category(
        id=str(uuid.uuid4()),
        user_id=test_user.id,
        name="Ăn uống",
        type="expense",
        color="#ec4899",
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@pytest.fixture(scope="function")
def test_category_income(db, test_user):
    category = Category(
        id=str(uuid.uuid4()),
        user_id=test_user.id,
        name="Lương",
        type="income",
        color="#16a34a",
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


# ─── Transaction Tests ────────────────────────────────────────────────────────

class TestCreateTransaction:
    def test_create_expense_transaction_success(self, db, test_user, auth_headers, test_wallet, test_category):
        payload = {
            "wallet_id": test_wallet.id,
            "category_id": test_category.id,
            "type": "expense",
            "amount": "50000",
            "currency": "VND",
            "note": "Ăn trưa",
            "transacted_at": datetime.utcnow().isoformat(),
            "source": "manual",
            "is_reviewed": True,
        }
        response = client.post("/api/transactions", json=payload, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "expense"
        assert Decimal(data["amount"]) == Decimal("50000")
        assert data["category_id"] == test_category.id
        assert data["wallet_id"] == test_wallet.id

    def test_create_income_transaction_success(self, db, test_user, auth_headers, test_wallet, test_category_income):
        payload = {
            "wallet_id": test_wallet.id,
            "category_id": test_category_income.id,
            "type": "income",
            "amount": "5000000",
            "currency": "VND",
            "transacted_at": datetime.utcnow().isoformat(),
        }
        response = client.post("/api/transactions", json=payload, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "income"
        assert Decimal(data["amount"]) == Decimal("5000000")

    def test_create_transaction_missing_required_fields(self, db, test_user, auth_headers, test_wallet):
        payload = {
            "wallet_id": test_wallet.id,
            "type": "expense",
            "amount": "50000",
            "transacted_at": datetime.utcnow().isoformat(),
        }
        response = client.post("/api/transactions", json=payload, headers=auth_headers)
        assert response.status_code == 422

    def test_create_transaction_invalid_amount(self, db, test_user, auth_headers, test_wallet, test_category):
        payload = {
            "wallet_id": test_wallet.id,
            "category_id": test_category.id,
            "type": "expense",
            "amount": "0",
            "transacted_at": datetime.utcnow().isoformat(),
        }
        response = client.post("/api/transactions", json=payload, headers=auth_headers)
        assert response.status_code == 422

    def test_create_transaction_wallet_not_found(self, db, test_user, auth_headers, test_category):
        payload = {
            "wallet_id": str(uuid.uuid4()),
            "category_id": test_category.id,
            "type": "expense",
            "amount": "50000",
            "transacted_at": datetime.utcnow().isoformat(),
        }
        response = client.post("/api/transactions", json=payload, headers=auth_headers)
        assert response.status_code == 404
        assert response.json()["detail"] == "Wallet not found"

    def test_create_transaction_unauthorized(self, db, test_wallet, test_category):
        payload = {
            "wallet_id": test_wallet.id,
            "category_id": test_category.id,
            "type": "expense",
            "amount": "50000",
            "transacted_at": datetime.utcnow().isoformat(),
        }
        response = client.post("/api/transactions", json=payload)
        assert response.status_code == 403


class TestListTransactions:
    def test_list_transactions_empty(self, db, test_user, auth_headers):
        response = client.get("/api/transactions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_transactions_with_pagination(self, db, test_user, auth_headers, test_wallet, test_category):
        now = datetime.utcnow()
        for i in range(15):
            txn = Transaction(
                id=str(uuid.uuid4()),
                wallet_id=test_wallet.id,
                category_id=test_category.id,
                type="expense",
                amount=Decimal(str((i + 1) * 10000)),
                currency="VND",
                transacted_at=now - timedelta(days=i),
                source="manual",
                is_reviewed=True,
            )
            db.add(txn)
        db.commit()

        response = client.get("/api/transactions?page=1&page_size=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["total"] == 15
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert data["total_pages"] == 2

        response = client.get("/api/transactions?page=2&page_size=10", headers=auth_headers)
        data = response.json()
        assert len(data["items"]) == 5
        assert data["page"] == 2

    def test_list_transactions_filter_by_wallet(self, db, test_user, auth_headers, test_wallet, test_wallet_2, test_category):
        now = datetime.utcnow()
        for i, wallet in enumerate([test_wallet, test_wallet_2]):
            for j in range(3):
                txn = Transaction(
                    id=str(uuid.uuid4()),
                    wallet_id=wallet.id,
                    category_id=test_category.id,
                    type="expense",
                    amount=Decimal("10000"),
                    currency="VND",
                    transacted_at=now - timedelta(days=j),
                    source="manual",
                    is_reviewed=True,
                )
                db.add(txn)
        db.commit()

        response = client.get(f"/api/transactions?wallet_id={test_wallet.id}", headers=auth_headers)
        data = response.json()
        assert data["total"] == 3

    def test_list_transactions_filter_by_type(self, db, test_user, auth_headers, test_wallet, test_category, test_category_income):
        now = datetime.utcnow()
        for i, cat in enumerate([test_category, test_category_income]):
            for j in range(2):
                txn = Transaction(
                    id=str(uuid.uuid4()),
                    wallet_id=test_wallet.id,
                    category_id=cat.id,
                    type=cat.type,
                    amount=Decimal("10000"),
                    currency="VND",
                    transacted_at=now - timedelta(days=j),
                    source="manual",
                    is_reviewed=True,
                )
                db.add(txn)
        db.commit()

        response = client.get("/api/transactions?type=expense", headers=auth_headers)
        data = response.json()
        assert data["total"] == 2

        response = client.get("/api/transactions?type=income", headers=auth_headers)
        data = response.json()
        assert data["total"] == 2

    def test_list_transactions_filter_by_date_range(self, db, test_user, auth_headers, test_wallet, test_category):
        now = datetime.utcnow()
        past_date = now - timedelta(days=10)
        recent_date = now - timedelta(days=1)

        txn_old = Transaction(
            id=str(uuid.uuid4()),
            wallet_id=test_wallet.id,
            category_id=test_category.id,
            type="expense",
            amount=Decimal("10000"),
            currency="VND",
            transacted_at=past_date,
            source="manual",
            is_reviewed=True,
        )
        txn_recent = Transaction(
            id=str(uuid.uuid4()),
            wallet_id=test_wallet.id,
            category_id=test_category.id,
            type="expense",
            amount=Decimal("20000"),
            currency="VND",
            transacted_at=recent_date,
            source="manual",
            is_reviewed=True,
        )
        db.add_all([txn_old, txn_recent])
        db.commit()

        response = client.get(f"/api/transactions?date_from={now.isoformat()}", headers=auth_headers)
        data = response.json()
        assert data["total"] == 1
        assert Decimal(data["items"][0]["amount"]) == Decimal("20000")

        response = client.get(
            f"/api/transactions?date_from={past_date.isoformat()}&date_to={recent_date.isoformat()}",
            headers=auth_headers,
        )
        data = response.json()
        assert data["total"] == 2


class TestUpdateTransaction:
    def test_update_transaction_amount(self, db, test_user, auth_headers, test_wallet, test_category):
        txn = Transaction(
            id=str(uuid.uuid4()),
            wallet_id=test_wallet.id,
            category_id=test_category.id,
            type="expense",
            amount=Decimal("50000"),
            currency="VND",
            transacted_at=datetime.utcnow(),
            source="manual",
            is_reviewed=True,
        )
        db.add(txn)
        db.commit()

        response = client.put(
            f"/api/transactions/{txn.id}",
            json={"amount": "100000"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert Decimal(response.json()["amount"]) == Decimal("100000")

    def test_update_transaction_not_found(self, db, test_user, auth_headers):
        response = client.put(
            f"/api/transactions/{str(uuid.uuid4())}",
            json={"amount": "100000"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestDeleteTransaction:
    def test_delete_transaction_success(self, db, test_user, auth_headers, test_wallet, test_category):
        txn = Transaction(
            id=str(uuid.uuid4()),
            wallet_id=test_wallet.id,
            category_id=test_category.id,
            type="expense",
            amount=Decimal("50000"),
            currency="VND",
            transacted_at=datetime.utcnow(),
            source="manual",
            is_reviewed=True,
        )
        db.add(txn)
        db.commit()
        txn_id = txn.id

        response = client.delete(f"/api/transactions/{txn_id}", headers=auth_headers)
        assert response.status_code == 204

        get_resp = client.get(f"/api/transactions/{txn_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    def test_delete_transaction_not_found(self, db, test_user, auth_headers):
        response = client.delete(f"/api/transactions/{str(uuid.uuid4())}", headers=auth_headers)
        assert response.status_code == 404


# ─── Transfer Tests ───────────────────────────────────────────────────────────

class TestCreateTransfer:
    def test_create_transfer_success(self, db, test_user, auth_headers, test_wallet, test_wallet_2):
        initial_balance_from = test_wallet.balance
        initial_balance_to = test_wallet_2.balance
        amount = "200000"

        payload = {
            "from_wallet_id": test_wallet.id,
            "to_wallet_id": test_wallet_2.id,
            "amount": amount,
            "note": "Chuyển tiền test",
        }
        response = client.post("/api/transfers", json=payload, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["from_wallet_id"] == test_wallet.id
        assert data["to_wallet_id"] == test_wallet_2.id
        assert Decimal(data["amount"]) == Decimal(amount)
        assert data["note"] == "Chuyển tiền test"

    def test_create_transfer_same_wallet_rejected(self, db, test_user, auth_headers, test_wallet):
        payload = {
            "from_wallet_id": test_wallet.id,
            "to_wallet_id": test_wallet.id,
            "amount": "100000",
        }
        response = client.post("/api/transfers", json=payload, headers=auth_headers)
        assert response.status_code == 400
        assert "same wallet" in response.json()["detail"].lower()

    def test_create_transfer_insufficient_balance(self, db, test_user, auth_headers, test_wallet, test_wallet_2):
        payload = {
            "from_wallet_id": test_wallet.id,
            "to_wallet_id": test_wallet_2.id,
            "amount": str(test_wallet.balance + 1000000),
        }
        response = client.post("/api/transfers", json=payload, headers=auth_headers)
        assert response.status_code == 400
        assert "insufficient" in response.json()["detail"].lower()

    def test_create_transfer_wallet_not_found(self, db, test_user, auth_headers, test_wallet):
        payload = {
            "from_wallet_id": str(uuid.uuid4()),
            "to_wallet_id": test_wallet.id,
            "amount": "100000",
        }
        response = client.post("/api/transfers", json=payload, headers=auth_headers)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_create_transfer_invalid_amount(self, db, test_user, auth_headers, test_wallet, test_wallet_2):
        payload = {
            "from_wallet_id": test_wallet.id,
            "to_wallet_id": test_wallet_2.id,
            "amount": "0",
        }
        response = client.post("/api/transfers", json=payload, headers=auth_headers)
        assert response.status_code == 422


class TestListTransfers:
    def test_list_transfers_empty(self, db, test_user, auth_headers):
        response = client.get("/api/transfers", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_transfers_success(self, db, test_user, auth_headers, test_wallet, test_wallet_2):
        transfer = Transfer(
            id=str(uuid.uuid4()),
            from_wallet_id=test_wallet.id,
            to_wallet_id=test_wallet_2.id,
            amount=Decimal("100000"),
            note="Test transfer",
            transferred_at=datetime.utcnow(),
        )
        db.add(transfer)
        db.commit()

        response = client.get("/api/transfers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == transfer.id
        assert data[0]["amount"] == "100000.00"

    def test_list_transfers_returns_transfers_from_both_directions(self, db, test_user, auth_headers, test_wallet, test_wallet_2):
        t1 = Transfer(
            id=str(uuid.uuid4()),
            from_wallet_id=test_wallet.id,
            to_wallet_id=test_wallet_2.id,
            amount=Decimal("100000"),
            transferred_at=datetime.utcnow(),
        )
        t2 = Transfer(
            id=str(uuid.uuid4()),
            from_wallet_id=test_wallet_2.id,
            to_wallet_id=test_wallet.id,
            amount=Decimal("50000"),
            transferred_at=datetime.utcnow(),
        )
        db.add_all([t1, t2])
        db.commit()

        response = client.get("/api/transfers", headers=auth_headers)
        data = response.json()
        assert len(data) == 2
