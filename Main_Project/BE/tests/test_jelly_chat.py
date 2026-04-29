import os
import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finance_svc.asgi import app
from finance_svc.core.database import get_db
from finance_svc.core.security import create_access_token
from finance_svc.models.base import Base
from finance_svc.models.category import Category
from finance_svc.models.user import User
from finance_svc.models.wallet import Wallet
from finance_svc.services import ai_service


TINY_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)

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


client = TestClient(app)


class FakeN8nResponse:
    def __init__(self, text):
        self.text = text

    def raise_for_status(self):
        return None


class FakeAsyncClient:
    calls = []

    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, json):
        self.calls.append({"url": url, "json": json})
        return FakeN8nResponse('{"type":"item","content":"Đã đọc hóa đơn."}\n{"type":"end"}')


@pytest.fixture(scope="function")
def db():
    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override


@pytest.fixture(scope="function")
def test_user(db):
    user = User(
        id=str(uuid.uuid4()),
        email="jelly-user@example.com",
        password_hash="$2b$12$dummy",
        full_name="Jelly Test User",
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
def finance_context(db, test_user):
    wallet = Wallet(
        id=str(uuid.uuid4()),
        user_id=test_user.id,
        name="Ví chính",
        balance=Decimal("1000000"),
        currency="VND",
        color="#2563eb",
        wallet_type="basic",
    )
    category = Category(
        id=str(uuid.uuid4()),
        user_id=test_user.id,
        name="Ăn uống",
        type="expense",
        color="#f97316",
    )
    db.add_all([wallet, category])
    db.commit()
    return {"wallet": wallet, "category": category}


@pytest.fixture(scope="function")
def n8n_mock(monkeypatch):
    FakeAsyncClient.calls = []
    monkeypatch.setattr(ai_service.settings, "n8n_webhook_url", "https://n8n.example.test/jelly")
    monkeypatch.setattr(ai_service.httpx, "AsyncClient", FakeAsyncClient)
    return FakeAsyncClient.calls


@pytest.mark.parametrize(
    "prompt",
    [
        "Đây là hóa đơn ăn trưa 85k, Jelly đọc và gợi ý tạo giao dịch chi giúp tôi.",
        "Hóa đơn cà phê này khoảng 120k, kiểm tra rồi chuẩn bị giao dịch chi nhé.",
        "Ảnh này là biên lai taxi 200k, hãy xác thực thông tin trước khi tạo giao dịch.",
    ],
)
def test_jelly_chat_forwards_user_prompt_when_image_and_custom_text_are_sent(
    db,
    auth_headers,
    finance_context,
    n8n_mock,
    prompt,
):
    payload = {
        "message": prompt,
        "session_id": "session-with-image-and-custom-text",
        "image_base64": "ZmFrZS1pbWFnZS1ieXRlcw==",
        "image_name": "receipt.jpg",
        "image_mime_type": "image/jpeg",
    }

    response = client.post("/api/ai/jelly-chat", json=payload, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["reply"] == "Đã đọc hóa đơn."
    assert len(n8n_mock) == 1

    forwarded_payload = n8n_mock[0]["json"]
    assert forwarded_payload["action"] == "sendMessage"
    assert forwarded_payload["sessionId"] == payload["session_id"]
    assert forwarded_payload["image"] == {
        "name": payload["image_name"],
        "mimeType": payload["image_mime_type"],
        "data": payload["image_base64"],
    }
    assert "[CÂU HỎI CỦA NGƯỜI DÙNG]" in forwarded_payload["chatInput"]
    assert prompt in forwarded_payload["chatInput"]
    assert "Phân tích hóa đơn trong ảnh này cho tôi." not in forwarded_payload["chatInput"]


def test_jelly_chat_uses_fallback_image_metadata_but_keeps_custom_prompt(
    db,
    auth_headers,
    finance_context,
    n8n_mock,
):
    prompt = "Tôi gửi ảnh hóa đơn siêu thị, đọc giúp và chuẩn bị giao dịch chi nếu hợp lệ."
    payload = {
        "message": prompt,
        "session_id": None,
        "image_base64": "ZmFrZS1pbWFnZS1ieXRlcw==",
    }

    response = client.post("/api/ai/jelly-chat", json=payload, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["session_id"]
    assert len(n8n_mock) == 1

    forwarded_payload = n8n_mock[0]["json"]
    assert forwarded_payload["image"]["name"] == "receipt.jpg"
    assert forwarded_payload["image"]["mimeType"] == "image/jpeg"
    assert forwarded_payload["image"]["data"] == payload["image_base64"]
    assert prompt in forwarded_payload["chatInput"]
    assert "Phân tích hóa đơn trong ảnh này cho tôi." not in forwarded_payload["chatInput"]


@pytest.mark.skipif(
    os.getenv("RUN_REAL_N8N_TESTS") != "1",
    reason="Set RUN_REAL_N8N_TESTS=1 to call the real Jelly n8n webhook.",
)
def test_jelly_chat_real_network_with_image_and_custom_text(
    db,
    auth_headers,
    finance_context,
    monkeypatch,
):
    webhook_url = os.getenv("REAL_N8N_WEBHOOK_URL") or ai_service.settings.n8n_webhook_url
    if not webhook_url:
        pytest.skip("N8N webhook URL is not configured.")

    monkeypatch.setattr(ai_service.settings, "n8n_webhook_url", webhook_url)

    prompt = (
        "Đây là ảnh hóa đơn test từ automated test. "
        "Hãy đọc ảnh nếu có thể và trả lời theo đúng nội dung tôi yêu cầu, không dùng prompt mặc định."
    )
    payload = {
        "message": prompt,
        "session_id": f"real-network-test-{uuid.uuid4()}",
        "image_base64": TINY_PNG_BASE64,
        "image_name": "real-network-test.png",
        "image_mime_type": "image/png",
    }

    response = client.post("/api/ai/jelly-chat", json=payload, headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == payload["session_id"]
    assert isinstance(data["reply"], str)
    assert data["reply"].strip()
