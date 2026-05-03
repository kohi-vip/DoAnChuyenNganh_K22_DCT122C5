import json
import statistics
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from groq import Groq
import httpx
from fastapi import HTTPException
from finance_svc.core.config import get_settings
from finance_svc.models.transaction import Transaction
from finance_svc.models.wallet import Wallet
from finance_svc.models.category import Category
from finance_svc.schemas.ai import (
    ParsedTransaction, NLQueryResponse, InsightResponse,
    AnomalyItem, AnomalyResponse, ChatMessage, ChatResponse,
    JellyChatRequest, JellyChatResponse,
)

settings = get_settings()

# In-memory chat sessions: session_id -> list of messages
_chat_sessions: dict[str, list[dict]] = {}

MAX_TURNS = 10


def _get_groq_client() -> Groq:
    return Groq(api_key=settings.groq_api_key)


def _get_user_categories(db: Session, user_id: str) -> list[str]:
    cats = db.query(Category).filter(Category.user_id == user_id, Category.is_active == True).all()
    return [c.name for c in cats]


def parse_natural_language(db: Session, user_id: str, text: str) -> ParsedTransaction:
    categories = _get_user_categories(db, user_id)
    category_list = ", ".join(categories)

    system_prompt = f"""Bạn là trợ lý tài chính. Người dùng nhập câu mô tả giao dịch bằng tiếng Việt.
Trích xuất thông tin và trả về JSON (KHÔNG có text thêm):
{{
  "amount": <số tiền VND, "50k"=50000, "1tr"=1000000>,
  "type": <"income" hoặc "expense">,
  "category": <tên từ danh sách: [{category_list}]>,
  "note": <mô tả ngắn>,
  "transacted_at": <ISO8601 nếu có, null nếu không>
}}"""

    client = _get_groq_client()
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        temperature=0,
        max_tokens=200,
    )

    raw = response.choices[0].message.content.strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        return ParsedTransaction(note=text, confidence=0.0)

    try:
        data = json.loads(raw[start:end])
        transacted_at = None
        if data.get("transacted_at"):
            try:
                transacted_at = datetime.fromisoformat(data["transacted_at"])
            except Exception:
                pass
        return ParsedTransaction(
            amount=Decimal(str(data.get("amount", 0))) if data.get("amount") else None,
            type=data.get("type"),
            category=data.get("category"),
            note=data.get("note"),
            transacted_at=transacted_at,
        )
    except (json.JSONDecodeError, Exception):
        return ParsedTransaction(note=text, confidence=0.0)


def natural_language_query(db: Session, user_id: str, question: str) -> NLQueryResponse:
    categories = _get_user_categories(db, user_id)
    category_list = ", ".join(categories)

    extract_prompt = f"""Người dùng hỏi về tài chính cá nhân. Trích xuất tham số truy vấn và trả về JSON:
{{
  "category_keyword": <từ khóa danh mục hoặc null>,
  "month": <tháng 1-12 hoặc null>,
  "year": <năm hoặc null>,
  "query_type": <"sum_expense"|"sum_income"|"count"|"top_categories"|"general">,
  "type": <"income"|"expense"|null>
}}
Danh mục có sẵn: [{category_list}]
Câu hỏi: {question}"""

    client = _get_groq_client()
    r1 = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": extract_prompt}],
        temperature=0,
        max_tokens=150,
    )
    raw1 = r1.choices[0].message.content.strip()
    start = raw1.find("{")
    end = raw1.rfind("}") + 1
    params = {}
    if start != -1 and end > 0:
        try:
            params = json.loads(raw1[start:end])
        except Exception:
            params = {}

    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    q = db.query(Transaction).filter(
        Transaction.wallet_id.in_(wallet_ids),
        Transaction.is_reviewed == True,
    )
    if params.get("month"):
        q = q.filter(extract("month", Transaction.transacted_at) == params["month"])
    if params.get("year"):
        q = q.filter(extract("year", Transaction.transacted_at) == params["year"])
    if params.get("type"):
        q = q.filter(Transaction.type == params["type"])

    db_data = {}
    query_type = params.get("query_type", "general")

    if query_type in ("sum_expense", "sum_income"):
        total = q.with_entities(func.sum(Transaction.amount)).scalar() or 0
        db_data = {"total": float(total), "month": params.get("month"), "year": params.get("year")}
    elif query_type == "top_categories":
        rows = (
            db.query(Category.name, func.sum(Transaction.amount).label("total"))
            .join(Transaction, Transaction.category_id == Category.id)
            .filter(Transaction.wallet_id.in_(wallet_ids), Transaction.is_reviewed == True)
            .group_by(Category.name)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(5)
            .all()
        )
        db_data = {"top_categories": [{"name": r.name, "total": float(r.total)} for r in rows]}
    else:
        total = q.with_entities(func.sum(Transaction.amount)).scalar() or 0
        db_data = {"total": float(total)}

    answer_prompt = f"""Người dùng hỏi: "{question}"
Dữ liệu thực từ DB: {json.dumps(db_data, ensure_ascii=False)}
Viết câu trả lời ngắn gọn, tự nhiên bằng tiếng Việt, đơn vị tiền tệ là VND."""

    r2 = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": answer_prompt}],
        temperature=0.3,
        max_tokens=300,
    )
    answer = r2.choices[0].message.content.strip()
    return NLQueryResponse(question=question, answer=answer, data=db_data)


MIN_TRANSACTIONS_FOR_INSIGHTS = 30


def get_insights(db: Session, user_id: str) -> InsightResponse:
    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    if not wallet_ids:
        return InsightResponse(
            analysis="Bạn chưa có ví nào. Hãy tạo ví và thêm giao dịch để Jelly có thể phân tích thói quen chi tiêu của bạn.",
            suggestions=[],
            period="",
        )

    base_q = db.query(Transaction).filter(
        Transaction.wallet_id.in_(wallet_ids),
        Transaction.is_reviewed == True,
    )
    total_tx = base_q.count()

    if total_tx < MIN_TRANSACTIONS_FOR_INSIGHTS:
        return InsightResponse(
            analysis=(
                f"Hiện bạn mới có {total_tx}/{MIN_TRANSACTIONS_FOR_INSIGHTS} giao dịch chính thức. "
                "Jelly cần đủ dữ liệu để phân tích thói quen chi tiêu và dòng tiền một cách đáng tin cậy. "
                "Hãy tiếp tục ghi nhận giao dịch — khi đạt đủ 30 giao dịch, hệ thống sẽ tự động đưa ra phân tích chi tiết."
            ),
            suggestions=[],
            period="",
        )

    # 1) Tổng thu/chi theo tháng (6 tháng gần nhất)
    month_rows = (
        db.query(
            extract("year", Transaction.transacted_at).label("year"),
            extract("month", Transaction.transacted_at).label("month"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("cnt"),
        )
        .filter(Transaction.wallet_id.in_(wallet_ids), Transaction.is_reviewed == True)
        .group_by("year", "month", Transaction.type)
        .order_by("year", "month")
        .all()
    )
    monthly: dict[str, dict] = {}
    for r in month_rows:
        key = f"{int(r.year)}-{int(r.month):02d}"
        bucket = monthly.setdefault(key, {"income": 0.0, "expense": 0.0, "income_count": 0, "expense_count": 0})
        bucket[r.type] = float(r.total)
        bucket[f"{r.type}_count"] = int(r.cnt)
    last_months = list(monthly.keys())[-3:]
    monthly_recent = {k: monthly[k] for k in last_months}

    # 2) Nguồn tiền vào — breakdown theo category (income)
    income_rows = (
        db.query(
            Category.name.label("name"),
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("cnt"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.wallet_id.in_(wallet_ids),
            Transaction.is_reviewed == True,
            Transaction.type == "income",
        )
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )
    income_by_cat = [
        {"category": r.name, "total": float(r.total), "count": int(r.cnt)} for r in income_rows
    ]

    # 3) Nguồn tiền ra — breakdown theo category (expense)
    expense_rows = (
        db.query(
            Category.name.label("name"),
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("cnt"),
            func.avg(Transaction.amount).label("avg_amt"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.wallet_id.in_(wallet_ids),
            Transaction.is_reviewed == True,
            Transaction.type == "expense",
        )
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )
    expense_by_cat = [
        {
            "category": r.name,
            "total": float(r.total),
            "count": int(r.cnt),
            "avg_per_tx": float(r.avg_amt or 0),
        }
        for r in expense_rows
    ]

    total_income = sum(c["total"] for c in income_by_cat)
    total_expense = sum(c["total"] for c in expense_by_cat)
    savings_rate = ((total_income - total_expense) / total_income * 100) if total_income > 0 else 0.0

    data_payload = {
        "total_transactions": total_tx,
        "monthly_recent": monthly_recent,
        "income_sources": income_by_cat,
        "expense_sources": expense_by_cat,
        "aggregate": {
            "total_income": round(total_income),
            "total_expense": round(total_expense),
            "net": round(total_income - total_expense),
            "savings_rate_pct": round(savings_rate, 1),
        },
    }
    data_str = json.dumps(data_payload, ensure_ascii=False)

    prompt = f"""Bạn là chuyên gia tài chính cá nhân. Dưới đây là dữ liệu giao dịch đã được xác nhận của người dùng (đơn vị VND):
{data_str}

Nhiệm vụ: phân tích CHI TIẾT (không nói chung chung) về:
1. **Thói quen chi tiêu**: danh mục nào chiếm tỷ trọng lớn nhất, tần suất giao dịch, giá trị trung bình/lần, có dấu hiệu chi tiêu tập trung hay dàn trải không.
2. **Nguồn tiền vào**: cơ cấu thu nhập (lương, thưởng, phụ thu, khác), mức độ đa dạng/ổn định.
3. **Nguồn tiền ra**: top danh mục chi tiêu, so sánh chi thiết yếu vs không thiết yếu, xu hướng tăng/giảm giữa các tháng gần nhất.
4. **Tỷ lệ tiết kiệm** và sức khỏe dòng tiền tổng thể.

Trả về JSON thuần (không markdown, không text ngoài JSON):
{{
  "analysis": "<đoạn phân tích 4-6 câu, nêu rõ con số cụ thể và tên danh mục>",
  "suggestions": ["<gợi ý hành động cụ thể gắn với danh mục thực tế>", "<gợi ý 2>", "<gợi ý 3>", "<gợi ý 4>"]
}}"""

    client = _get_groq_client()
    r = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=900,
    )
    raw = r.choices[0].message.content.strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    period = ", ".join(last_months)
    try:
        data = json.loads(raw[start:end])
        return InsightResponse(
            analysis=data.get("analysis", ""),
            suggestions=data.get("suggestions", []),
            period=period,
        )
    except Exception:
        return InsightResponse(analysis=raw, suggestions=[], period=period)

def _build_user_financial_context(db: Session, user_id: str) -> dict:
    # Lấy toàn bộ context tài chính của user (tháng này + tháng trước) để inject vào system prompt cho AI trả lời chi tiết theo từng danh mục.#
    wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    now = datetime.now()

    def _get_month_summary(month: int, year: int) -> dict:
        q_base = db.query(Transaction).filter(
            Transaction.wallet_id.in_(wallet_ids),
            Transaction.is_reviewed == True,
            extract("month", Transaction.transacted_at) == month,
            extract("year", Transaction.transacted_at) == year,
        )
        income = float(q_base.filter(Transaction.type == "income").with_entities(func.sum(Transaction.amount)).scalar() or 0)
        expense = float(q_base.filter(Transaction.type == "expense").with_entities(func.sum(Transaction.amount)).scalar() or 0)

        # Tất cả danh mục chi tiêu tháng đó
        expense_by_cat = (
            db.query(Category.name, func.sum(Transaction.amount).label("total"))
            .join(Transaction, Transaction.category_id == Category.id)
            .filter(
                Transaction.wallet_id.in_(wallet_ids),
                Transaction.is_reviewed == True,
                Transaction.type == "expense",
                extract("month", Transaction.transacted_at) == month,
                extract("year", Transaction.transacted_at) == year,
            )
            .group_by(Category.name)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )
        expense_cats_str = "\n".join([
            f"    • {r.name}: {float(r.total):,.0f}đ" for r in expense_by_cat
        ]) or "    (chưa có)"

        # Tất cả danh mục thu nhập
        income_by_cat = (
            db.query(Category.name, func.sum(Transaction.amount).label("total"))
            .join(Transaction, Transaction.category_id == Category.id)
            .filter(
                Transaction.wallet_id.in_(wallet_ids),
                Transaction.is_reviewed == True,
                Transaction.type == "income",
                extract("month", Transaction.transacted_at) == month,
                extract("year", Transaction.transacted_at) == year,
            )
            .group_by(Category.name)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )
        income_cats_str = "\n".join([
            f"    • {r.name}: {float(r.total):,.0f}đ" for r in income_by_cat
        ]) or "    (chưa có)"

        return {
            "income": income,
            "expense": expense,
            "balance": income - expense,
            "expense_cats_str": expense_cats_str,
            "income_cats_str": income_cats_str,
        }

    this_month = _get_month_summary(now.month, now.year)
    prev_month_date = (now.replace(day=1) - __import__("datetime").timedelta(days=1))
    prev_month = _get_month_summary(prev_month_date.month, prev_month_date.year)

    # 10 giao dịch gần nhất
    recent_txns = (
        db.query(Transaction, Category.name.label("cat_name"))
        .outerjoin(Category, Transaction.category_id == Category.id)
        .filter(Transaction.wallet_id.in_(wallet_ids), Transaction.is_reviewed == True)
        .order_by(Transaction.transacted_at.desc())
        .limit(10)
        .all()
    )
    recent_str = "\n".join([
        f"    • {t.transacted_at.strftime('%d/%m') if t.transacted_at else '??'} "
        f"{'Thu' if t.type == 'income' else 'Chi'} {float(t.amount):,.0f}đ "
        f"— {cat or '?'} ({t.note or 'không ghi chú'})"
        for t, cat in recent_txns
    ]) or "    (chưa có giao dịch)"

    return {
        "now": now,
        "prev_month_date": prev_month_date,
        "this_month": this_month,
        "prev_month": prev_month,
        "recent_str": recent_str,
    }


def chat(db: Session, user_id: str, message: str, session_id: str | None) -> ChatResponse:
    if not session_id:
        session_id = str(uuid.uuid4())

    if session_id not in _chat_sessions:
        _chat_sessions[session_id] = []

    ctx = _build_user_financial_context(db, user_id)
    now = ctx["now"]
    tm = ctx["this_month"]
    pm = ctx["prev_month"]
    pmd = ctx["prev_month_date"]

    system_prompt = f"""Bạn là Jelly — chuyên viên tư vấn tài chính cá nhân của ứng dụng CaiSoCai.

═══ DỮ LIỆU TÀI CHÍNH CÁ NHÂN CỦA NGƯỜI DÙNG ═══

▌ THÁNG NÀY ({now.month}/{now.year}):
  Tổng thu: {tm['income']:,.0f} VND
  Tổng chi: {tm['expense']:,.0f} VND
  Số dư: {tm['balance']:,.0f} VND
  Chi tiêu theo danh mục:
{tm['expense_cats_str']}
  Thu nhập theo danh mục:
{tm['income_cats_str']}

▌ THÁNG TRƯỚC ({pmd.month}/{pmd.year}):
  Tổng thu: {pm['income']:,.0f} VND
  Tổng chi: {pm['expense']:,.0f} VND
  Số dư: {pm['balance']:,.0f} VND
  Chi tiêu theo danh mục:
{pm['expense_cats_str']}

▌ 10 GIAO DỊCH GẦN NHẤT:
{ctx['recent_str']}

═══════════════════════════════════════════════════

PHẠM VI: Chỉ tư vấn về quản lý thu chi cá nhân, tiết kiệm, lập ngân sách. Từ chối lịch sự nếu hỏi ngoài phạm vi.

QUY TẮC TRẢ LỜI:
1. Luôn dùng tiếng Việt tự nhiên, ngắn gọn, dễ hiểu
2. Câu hỏi về số tiền theo danh mục → tra cứu từ dữ liệu ở trên và trích dẫn chính xác
3. So sánh tháng này vs tháng trước khi có liên quan
4. Phân tích chi tiêu → nêu: tổng / nhóm chính / điểm bất thường / gợi ý tiết kiệm cụ thể
5. Độ dài: 2-4 câu cho câu thường, tối đa 8 câu cho phân tích sâu
6. Không tư vấn đầu tư rủi ro cao khi chưa đủ dữ liệu"""

    history = _chat_sessions[session_id]
    history.append({"role": "user", "content": message})

    if len(history) > MAX_TURNS * 2:
        history = history[-MAX_TURNS * 2:]
        _chat_sessions[session_id] = history

    client = _get_groq_client()
    messages = [{"role": "system", "content": system_prompt}] + history
    r = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.5,
        max_tokens=400,
    )
    reply = r.choices[0].message.content.strip()
    history.append({"role": "assistant", "content": reply})

    return ChatResponse(
        session_id=session_id,
        reply=reply,
        history=[ChatMessage(role=m["role"], content=m["content"]) for m in history],
    )


async def jelly_chat(
    db: Session,
    user_id: str,
    message: str,
    session_id: str | None,
    image_base64: str | None = None,
    image_name: str | None = None,
    image_mime_type: str | None = None,
) -> JellyChatResponse:
    
    # Proxy sang n8n Jelly chatbot.
    # - Inject toàn bộ context tài chính của user (tháng này + tháng trước) vào message
    # - Forward sang n8n webhook với image nếu có
    #- Parse SSE streaming response hoặc JSON thường từ n8n 
    
    if not session_id:
        session_id = str(uuid.uuid4())

    n8n_url = settings.n8n_webhook_url
    if not n8n_url:
        raise HTTPException(
            status_code=503,
            detail="n8n AI service chưa cấu hình. Vui lòng set N8N_WEBHOOK_URL trong .env",
        )

    # Build context tài chính để bơm vào message gửi n8n
    ctx = _build_user_financial_context(db, user_id)
    now = ctx["now"]
    tm = ctx["this_month"]
    pm = ctx["prev_month"]
    pmd = ctx["prev_month_date"]

    context_block = (
        f"[DỮ LIỆU TÀI CHÍNH NGƯỜI DÙNG]\n"
        f"Tháng {now.month}/{now.year}: Thu {tm['income']:,.0f}đ | Chi {tm['expense']:,.0f}đ | Dư {tm['balance']:,.0f}đ\n"
        f"Chi theo danh mục tháng này:\n{tm['expense_cats_str']}\n"
        f"Tháng {pmd.month}/{pmd.year}: Thu {pm['income']:,.0f}đ | Chi {pm['expense']:,.0f}đ | Dư {pm['balance']:,.0f}đ\n"
        f"Chi theo danh mục tháng trước:\n{pm['expense_cats_str']}\n"
        f"10 giao dịch gần nhất:\n{ctx['recent_str']}\n"
        f"\n[CÂU HỎI CỦA NGƯỜI DÙNG]\n{message}"
    )

    payload: dict = {
        "action": "sendMessage",
        "sessionId": session_id,
        "chatInput": context_block,
    }
    if image_base64:
        payload["image"] = {
            "name": image_name or "receipt.jpg",
            "mimeType": image_mime_type or "image/jpeg",
            "data": image_base64,
        }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(n8n_url, json=payload)
            response.raise_for_status()

            body = response.text.strip()
            reply = ""

            lines = [l.strip() for l in body.splitlines() if l.strip()]
            has_sse_prefix = any(l.startswith("data:") for l in lines)

            if has_sse_prefix:
                # SSE format: data: {"text":"..."} / data: {"done":true}
                for line in lines:
                    if not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if not data_str or data_str == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(data_str)
                        if "text" in chunk:
                            reply += chunk["text"]
                        elif "output" in chunk:
                            reply = chunk["output"]
                            break
                        elif chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        if data_str not in ("[DONE]", ""):
                            reply += data_str
            else:
                # NDJSON — n8n streaming gửi nhiều dòng JSON với field "type"
                # Các event types: "begin"(metadata), "token"/"chunk"/"text"(nội dung), "end"(kết thúc)
                text_chunks: list[str] = []
                final_output: str | None = None

                for line in lines:
                    try:
                        chunk = json.loads(line)
                        event_type = chunk.get("type", "")

                        if event_type == "begin":
                            # Metadata event — bỏ qua
                            continue

                        if event_type == "end":
                            # n8n có thể nhét output vào end event
                            for key in ("output", "text", "response", "message"):
                                val = chunk.get(key)
                                if isinstance(val, str) and val.strip():
                                    final_output = final_output or val
                                    break
                                elif isinstance(val, dict):
                                    for k in ("text", "output", "content", "message"):
                                        if val.get(k):
                                            final_output = final_output or str(val[k])
                                            break
                            continue

                        # n8n Agent streaming: type="item" với content từng chunk
                        if event_type == "item" and isinstance(chunk.get("content"), str):
                            text_chunks.append(chunk["content"])
                        # Các format khác (dự phòng)
                        elif isinstance(chunk.get("text"), str) and chunk["text"]:
                            text_chunks.append(chunk["text"])
                        elif isinstance(chunk.get("token"), str) and chunk["token"]:
                            text_chunks.append(chunk["token"])
                        elif isinstance(chunk.get("output"), str) and chunk["output"]:
                            final_output = chunk["output"]
                        elif isinstance(chunk.get("message"), str) and chunk["message"]:
                            final_output = final_output or chunk["message"]
                        elif isinstance(chunk.get("response"), str) and chunk["response"]:
                            final_output = final_output or chunk["response"]

                    except json.JSONDecodeError:
                        pass

                if text_chunks:
                    reply = "".join(text_chunks)
                elif final_output:
                    reply = final_output
                else:
                    # Không parse được — trả body thô để debug (tối đa 500 ký tự)
                    reply = f"[DEBUG] n8n response không parse được: {body[:500]}"

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="n8n AI service timeout — thử lại sau.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"n8n trả về lỗi HTTP {e.response.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Không kết nối được n8n: {str(e)}")

    return JellyChatResponse(session_id=session_id, reply=reply.strip() or "Jelly chưa trả lời được. Thử lại nhé!")
