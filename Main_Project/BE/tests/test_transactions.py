import uuid
from datetime import date, datetime, timedelta
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
from finance_svc.models.notification import Notification
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
        password_hash="$2b$12$dummy",
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
        initial_balance = test_wallet.balance
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
        db.refresh(test_wallet)
        assert test_wallet.balance == initial_balance - Decimal("50000")

    def test_create_income_transaction_success(self, db, test_user, auth_headers, test_wallet, test_category_income):
        initial_balance = test_wallet.balance
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
        db.refresh(test_wallet)
        assert test_wallet.balance == initial_balance + Decimal("5000000")

    def test_create_transaction_missing_required_fields(self, db, test_user, auth_headers, test_wallet):
        payload = {
            "wallet_id": test_wallet.id,
            "type": "expense",
            # amount is required — sending a string or missing it triggers 422
            "amount": "not_a_number",
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
        assert response.status_code == 401


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

        response = client.get(f"/api/transactions?date_from={recent_date.isoformat()}", headers=auth_headers)
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
        initial_balance = test_wallet.balance
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
        test_wallet.balance = initial_balance - txn.amount
        db.add(txn)
        db.commit()

        response = client.put(
            f"/api/transactions/{txn.id}",
            json={"amount": "100000"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert Decimal(response.json()["amount"]) == Decimal("100000")
        db.refresh(test_wallet)
        assert test_wallet.balance == initial_balance - Decimal("100000")

    def test_update_income_transaction_amount_recalculates_wallet_balance(
        self, db, test_user, auth_headers, test_wallet, test_category_income
    ):
        initial_balance = test_wallet.balance
        txn = Transaction(
            id=str(uuid.uuid4()),
            wallet_id=test_wallet.id,
            category_id=test_category_income.id,
            type="income",
            amount=Decimal("200000"),
            currency="VND",
            transacted_at=datetime.utcnow(),
            source="manual",
            is_reviewed=True,
        )
        test_wallet.balance = initial_balance + txn.amount
        db.add(txn)
        db.commit()

        response = client.put(
            f"/api/transactions/{txn.id}",
            json={"amount": "350000"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert Decimal(response.json()["amount"]) == Decimal("350000")
        db.refresh(test_wallet)
        assert test_wallet.balance == initial_balance + Decimal("350000")

    def test_update_transaction_type_replaces_previous_balance_effect(
        self, db, test_user, auth_headers, test_wallet, test_category, test_category_income
    ):
        initial_balance = test_wallet.balance
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
        test_wallet.balance = initial_balance - txn.amount
        db.add(txn)
        db.commit()

        response = client.put(
            f"/api/transactions/{txn.id}",
            json={
                "type": "income",
                "amount": "75000",
                "category_id": test_category_income.id,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json()["type"] == "income"
        db.refresh(test_wallet)
        assert test_wallet.balance == initial_balance + Decimal("75000")

    def test_update_transaction_not_found(self, db, test_user, auth_headers):
        response = client.put(
            f"/api/transactions/{str(uuid.uuid4())}",
            json={"amount": "100000"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestDeleteTransaction:
    def test_delete_transaction_success(self, db, test_user, auth_headers, test_wallet, test_category):
        initial_balance = test_wallet.balance
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
        test_wallet.balance = initial_balance - txn.amount
        db.add(txn)
        db.commit()
        txn_id = txn.id

        response = client.delete(f"/api/transactions/{txn_id}", headers=auth_headers)
        assert response.status_code == 204
        db.refresh(test_wallet)
        assert test_wallet.balance == initial_balance

        get_resp = client.get(f"/api/transactions/{txn_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    def test_delete_income_transaction_reverts_wallet_balance(
        self, db, test_user, auth_headers, test_wallet, test_category_income
    ):
        initial_balance = test_wallet.balance
        txn = Transaction(
            id=str(uuid.uuid4()),
            wallet_id=test_wallet.id,
            category_id=test_category_income.id,
            type="income",
            amount=Decimal("250000"),
            currency="VND",
            transacted_at=datetime.utcnow(),
            source="manual",
            is_reviewed=True,
        )
        test_wallet.balance = initial_balance + txn.amount
        db.add(txn)
        db.commit()
        txn_id = txn.id

        response = client.delete(f"/api/transactions/{txn_id}", headers=auth_headers)

        assert response.status_code == 204
        db.refresh(test_wallet)
        assert test_wallet.balance == initial_balance

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
        db.refresh(test_wallet)
        db.refresh(test_wallet_2)
        assert test_wallet.balance == initial_balance_from - Decimal(amount)
        assert test_wallet_2.balance == initial_balance_to + Decimal(amount)
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


class TestAuthApi:
    def test_register_seeds_default_categories_and_login_returns_tokens(self, db):
        email = "new-user@example.com"
        password = "secret123"

        register_response = client.post(
            "/api/auth/register",
            json={"email": email, "password": password, "full_name": "New User"},
        )

        assert register_response.status_code == 201
        registered_user = register_response.json()
        assert registered_user["email"] == email

        seeded_categories = db.query(Category).filter(
            Category.user_id == registered_user["id"]
        ).all()
        assert len(seeded_categories) >= 1

        login_response = client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )

        assert login_response.status_code == 200
        tokens = login_response.json()
        assert tokens["access_token"]
        assert tokens["refresh_token"]

        me_response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert me_response.status_code == 200
        assert me_response.json()["email"] == email

    def test_register_duplicate_email_is_rejected(self, db, test_user):
        response = client.post(
            "/api/auth/register",
            json={
                "email": test_user.email,
                "password": "secret123",
                "full_name": "Duplicate User",
            },
        )

        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()


class TestWalletApi:
    def test_wallet_lifecycle_and_total_balance(self, db, test_user, auth_headers, test_wallet):
        response = client.post(
            "/api/wallets",
            json={
                "name": "Side Wallet",
                "initial_balance": "250000",
                "currency": "VND",
                "color": "#0ea5e9",
                "icon": "wallet",
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        wallet_data = response.json()
        wallet_id = wallet_data["id"]
        assert wallet_data["name"] == "Side Wallet"
        assert Decimal(str(wallet_data["balance"])) == Decimal("250000")

        total_response = client.get("/api/wallets/total-balance", headers=auth_headers)
        assert total_response.status_code == 200
        assert Decimal(str(total_response.json()["total_balance"])) == (
            test_wallet.balance + Decimal("250000")
        )

        update_response = client.put(
            f"/api/wallets/{wallet_id}",
            json={"name": "Archived Wallet", "is_active": False},
            headers=auth_headers,
        )
        assert update_response.status_code == 200
        assert update_response.json()["name"] == "Archived Wallet"
        assert update_response.json()["is_active"] is False

        total_after_archive = client.get("/api/wallets/total-balance", headers=auth_headers)
        assert Decimal(str(total_after_archive.json()["total_balance"])) == test_wallet.balance

        delete_response = client.delete(f"/api/wallets/{wallet_id}", headers=auth_headers)
        assert delete_response.status_code == 204

        get_response = client.get(f"/api/wallets/{wallet_id}", headers=auth_headers)
        assert get_response.status_code == 404


class TestCategoryApi:
    def test_create_parent_and_child_category_then_hide_inactive_child(
        self, db, test_user, auth_headers
    ):
        parent_response = client.post(
            "/api/categories",
            json={
                "name": "Housing",
                "type": "expense",
                "color": "#64748b",
                "icon": "home",
            },
            headers=auth_headers,
        )
        assert parent_response.status_code == 201
        parent_id = parent_response.json()["id"]

        child_response = client.post(
            "/api/categories",
            json={
                "name": "Rent",
                "type": "expense",
                "parent_id": parent_id,
                "color": "#334155",
                "icon": "receipt",
            },
            headers=auth_headers,
        )
        assert child_response.status_code == 201
        child_id = child_response.json()["id"]

        list_response = client.get("/api/categories", headers=auth_headers)
        assert list_response.status_code == 200
        parent = next(item for item in list_response.json() if item["id"] == parent_id)
        assert [child["id"] for child in parent["children"]] == [child_id]

        update_response = client.put(
            f"/api/categories/{child_id}",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert update_response.status_code == 200
        assert update_response.json()["is_active"] is False

        list_after_hide = client.get("/api/categories", headers=auth_headers)
        parent_after_hide = next(
            item for item in list_after_hide.json() if item["id"] == parent_id
        )
        assert parent_after_hide["children"] == []


class TestRecurringApi:
    def test_pay_now_creates_transaction_and_updates_wallet_balance(
        self, db, test_user, auth_headers, test_wallet, test_category
    ):
        initial_balance = test_wallet.balance
        today = date.today().isoformat()

        create_response = client.post(
            "/api/recurring",
            json={
                "wallet_id": test_wallet.id,
                "category_id": test_category.id,
                "type": "expense",
                "amount": "100000",
                "note": "Monthly fee",
                "frequency": "monthly",
                "start_date": today,
                "next_due_date": today,
                "execution_time": "08:00:00",
                "notification_enabled": True,
                "remind_before_minutes": 30,
            },
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        rec_id = create_response.json()["id"]

        pay_response = client.post(f"/api/recurring/{rec_id}/pay-now", headers=auth_headers)

        assert pay_response.status_code == 200
        assert pay_response.json()["next_due_date"] != today
        db.refresh(test_wallet)
        assert test_wallet.balance == initial_balance - Decimal("100000")

        generated_txn = db.query(Transaction).filter(Transaction.recurring_id == rec_id).one()
        assert generated_txn.source == "manual"
        assert generated_txn.type == "expense"
        assert generated_txn.amount == Decimal("100000")


class TestReportsApi:
    def test_summary_and_category_reports_use_reviewed_transactions_only(
        self, db, test_user, auth_headers, test_wallet, test_category, test_category_income
    ):
        db.add_all([
            Transaction(
                id=str(uuid.uuid4()),
                wallet_id=test_wallet.id,
                category_id=test_category_income.id,
                type="income",
                amount=Decimal("2000000"),
                currency="VND",
                transacted_at=datetime(2026, 5, 10, 9, 0, 0),
                source="manual",
                is_reviewed=True,
            ),
            Transaction(
                id=str(uuid.uuid4()),
                wallet_id=test_wallet.id,
                category_id=test_category.id,
                type="expense",
                amount=Decimal("500000"),
                currency="VND",
                transacted_at=datetime(2026, 5, 12, 12, 0, 0),
                source="manual",
                is_reviewed=True,
            ),
            Transaction(
                id=str(uuid.uuid4()),
                wallet_id=test_wallet.id,
                category_id=test_category.id,
                type="expense",
                amount=Decimal("999999"),
                currency="VND",
                transacted_at=datetime(2026, 5, 13, 12, 0, 0),
                source="manual",
                is_reviewed=False,
            ),
        ])
        db.commit()

        summary_response = client.get(
            "/api/reports/summary?month=5&year=2026",
            headers=auth_headers,
        )
        assert summary_response.status_code == 200
        summary = summary_response.json()
        assert Decimal(str(summary["total_income"])) == Decimal("2000000")
        assert Decimal(str(summary["total_expense"])) == Decimal("500000")
        assert Decimal(str(summary["balance"])) == Decimal("1500000")
        assert summary["saving_rate"] == 75.0

        category_response = client.get(
            "/api/reports/by-category?month=5&year=2026",
            headers=auth_headers,
        )
        assert category_response.status_code == 200
        categories = category_response.json()["items"]
        assert len(categories) == 1
        assert categories[0]["category_id"] == test_category.id
        assert Decimal(str(categories[0]["amount"])) == Decimal("500000")
        assert categories[0]["percentage"] == 100.0


class TestNotificationsApi:
    def test_notification_read_unread_flow_and_unread_count(self, db, test_user, auth_headers):
        notification = Notification(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            recurring_id=None,
            title="Payment reminder",
            message="Review this payment",
            notification_type="reminder",
            scheduled_for=datetime.utcnow(),
            is_read=False,
        )
        db.add(notification)
        db.commit()
        notification_id = notification.id

        unread_response = client.get("/api/notifications/unread-count", headers=auth_headers)
        assert unread_response.status_code == 200
        assert unread_response.json()["unread_count"] == 1

        list_response = client.get("/api/notifications?is_read=false", headers=auth_headers)
        assert list_response.status_code == 200
        assert list_response.json()["total"] == 1
        assert list_response.json()["items"][0]["id"] == notification_id
        assert list_response.json()["items"][0]["is_paid"] is False

        read_response = client.patch(
            f"/api/notifications/{notification_id}/read",
            headers=auth_headers,
        )
        assert read_response.status_code == 200
        assert read_response.json()["is_read"] is True
        assert read_response.json()["read_at"] is not None

        unread_after_read = client.get("/api/notifications/unread-count", headers=auth_headers)
        assert unread_after_read.json()["unread_count"] == 0

        mark_unread_response = client.patch(
            f"/api/notifications/{notification_id}/unread",
            headers=auth_headers,
        )
        assert mark_unread_response.status_code == 200
        assert mark_unread_response.json()["is_read"] is False
        assert mark_unread_response.json()["read_at"] is None
