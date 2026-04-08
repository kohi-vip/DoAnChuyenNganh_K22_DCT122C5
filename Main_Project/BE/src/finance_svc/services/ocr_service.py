import base64
import json
from decimal import Decimal
from fastapi import UploadFile, HTTPException
import httpx
from finance_svc.core.config import get_settings
from finance_svc.schemas.ai import OCRReceiptResponse

settings = get_settings()


def _parse_n8n_ocr_response(body: str) -> dict:
    """
    Parse response từ n8n OCR workflow (streaming NDJSON).
    Workflow dùng responseMode=streaming + Information Agent streaming nên trả về NDJSON:
      {"type":"begin", ...}
      {"type":"item","content":"{"amount":...","metadata":{}}   ← từng ký tự JSON
      {"type":"end", ...}

    Cần gom tất cả type:item content → reconstruct JSON string → parse.
    Fallback sang JSON thường nếu không phải streaming.
    """
    body = body.strip()
    if not body:
        return {}

    lines = [l.strip() for l in body.splitlines() if l.strip()]

    # --- Thử parse JSON thường / array trước (trường hợp webhook không streaming) ---
    if len(lines) == 1:
        try:
            data = json.loads(lines[0])
            if isinstance(data, list):
                data = data[0] if data else {}
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            pass

    # --- NDJSON streaming: gom type:item content ---
    item_chunks: list[str] = []
    end_output: dict | None = None

    for line in lines:
        try:
            chunk = json.loads(line)
        except json.JSONDecodeError:
            continue

        event_type = chunk.get("type", "")

        if event_type == "begin":
            continue

        if event_type == "item" and isinstance(chunk.get("content"), str):
            item_chunks.append(chunk["content"])
            continue

        if event_type == "end":
            # n8n có thể nhét output vào end event
            for key in ("output", "text", "response", "message"):
                val = chunk.get(key)
                if isinstance(val, str) and val.strip():
                    end_output = _try_extract_json(val)
                    break
                elif isinstance(val, dict):
                    end_output = val
                    break
            continue

        # Non-streaming line với data trực tiếp
        if not event_type and isinstance(chunk, dict):
            # Có thể là output trực tiếp từ parse output to json node
            if any(k in chunk for k in ("amount", "vendor", "date", "suggested_category", "total")):
                return chunk

    # Ưu tiên: reconstruct từ item chunks
    if item_chunks:
        accumulated = "".join(item_chunks)
        extracted = _try_extract_json(accumulated)
        if extracted:
            return extracted

    # Fallback: end event output
    if end_output:
        return end_output

    # Last resort: thử merge tất cả lines có chứa data field
    merged: dict = {}
    for line in lines:
        try:
            chunk = json.loads(line)
            if isinstance(chunk, dict) and any(
                k in chunk for k in ("amount", "vendor", "date", "suggested_category", "total")
            ):
                merged.update(chunk)
        except json.JSONDecodeError:
            pass
    return merged


def _try_extract_json(text: str) -> dict:
    """Tìm và parse JSON object đầu tiên trong chuỗi text."""
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            data = json.loads(text[start:end])
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            pass
    return {}


def _extract_ocr_fields(data: dict) -> dict:
    """
    Trích xuất field từ response n8n OCR workflow.
    n8n 'parse output to json' node trả về: amount, vendor, date, suggested_category,
    note, line_items, confidence, needs_review, warnings.
    """
    def _get(*keys):
        for k in keys:
            v = data.get(k)
            if v is not None:
                return v
        return None

    # Tổng tiền — n8n workflow trả về 'amount' trực tiếp
    amount = _get("amount", "total", "total_amount", "grand_total", "subtotal")

    # Ngày — workflow trả về 'date' hoặc 'transacted_at'
    date = _get("transacted_at", "date", "invoice_date", "receipt_date", "transaction_date")

    # Vendor
    vendor_raw = _get("vendor", "vendor_name", "store_name", "merchant_name", "company")
    if isinstance(vendor_raw, dict):
        vendor = vendor_raw.get("name") or vendor_raw.get("raw_name") or str(vendor_raw)
    else:
        vendor = vendor_raw

    # Category gợi ý
    suggested_category = _get("suggested_category", "category", "expense_category")

    # Line items
    line_items_raw = _get("line_items", "items", "products")
    line_items = line_items_raw if isinstance(line_items_raw, list) else []

    return {
        "amount": amount,
        "date": date,
        "vendor": vendor,
        "suggested_category": suggested_category,
        "line_items": line_items,
    }


async def parse_receipt(file: UploadFile, user_categories: list[str]) -> OCRReceiptResponse:
    n8n_ocr_url = settings.n8n_ocr_webhook_url

    if n8n_ocr_url:
        return await _parse_receipt_via_n8n(file, user_categories, n8n_ocr_url)
    else:
        return await _parse_receipt_via_veryfi(file, user_categories)


async def _parse_receipt_via_n8n(
    file: UploadFile,
    user_categories: list[str],
    n8n_url: str,
) -> OCRReceiptResponse:
    """
    Gửi ảnh hóa đơn lên n8n OCR webhook dưới dạng multipart/form-data.
    n8n nhận file binary, xử lý OCR, trả về JSON kết quả.
    """
    file_bytes = await file.read()
    filename = file.filename or "receipt.jpg"
    mime_type = file.content_type or "image/jpeg"

    # Encode ảnh sang base64, gửi cùng format với Jelly chatbot
    file_base64 = base64.b64encode(file_bytes).decode("utf-8")
    payload = {
        "image": {
            "name": filename,
            "mimeType": mime_type,
            "data": file_base64,
        },
        "categories": user_categories,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(n8n_url, json=payload)
            response.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="n8n OCR service timeout — thử lại sau.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"n8n OCR lỗi HTTP {e.response.status_code}: {e.response.text[:300]}",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Không kết nối được n8n OCR: {str(e)}")

    raw_data = _parse_n8n_ocr_response(response.text)
    fields = _extract_ocr_fields(raw_data)

    amount = fields["amount"]
    date = fields["date"]
    vendor = fields["vendor"]
    suggested_category = fields["suggested_category"]
    line_items = fields["line_items"]

    # Nếu n8n chưa suggest category → dùng Groq để gợi ý
    if not suggested_category and vendor and user_categories:
        suggested_category = _suggest_category_with_groq(vendor, user_categories)

    return OCRReceiptResponse(
        amount=Decimal(str(amount)) if amount is not None else None,
        date=str(date) if date else None,
        vendor=str(vendor) if vendor else None,
        suggested_category=suggested_category,
        line_items=line_items,
        raw_data={k: v for k, v in raw_data.items() if k != "line_items"},
    )


async def _parse_receipt_via_veryfi(
    file: UploadFile,
    user_categories: list[str],
) -> OCRReceiptResponse:
    """Fallback: OCR trực tiếp qua Veryfi SDK (dùng khi không có N8N_OCR_WEBHOOK_URL)."""
    try:
        from veryfi import Client as VeryfiClient
        client = VeryfiClient(
            client_id=settings.veryfi_client_id,
            client_secret=settings.veryfi_client_secret,
            username=settings.veryfi_username,
            api_key=settings.veryfi_api_key,
        )
    except Exception:
        raise HTTPException(status_code=503, detail="Veryfi OCR service not configured")

    file_bytes = await file.read()
    try:
        result = client.process_document_from_stream(
            file_bytes,
            file_name=file.filename or "receipt.jpg",
            categories=[],
            delete_after_processing=True,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OCR processing failed: {str(e)}")

    amount = result.get("total", None)
    date = result.get("date", None)
    vendor_raw = result.get("vendor")
    vendor = vendor_raw.get("name") if isinstance(vendor_raw, dict) else result.get("vendor_name")
    line_items = result.get("line_items", [])

    suggested_category = _suggest_category_with_groq(vendor, user_categories) if vendor and user_categories else None

    return OCRReceiptResponse(
        amount=Decimal(str(amount)) if amount else None,
        date=str(date) if date else None,
        vendor=vendor,
        suggested_category=suggested_category,
        line_items=line_items if isinstance(line_items, list) else [],
        raw_data={k: v for k, v in result.items() if k not in ("line_items",)},
    )


def _suggest_category_with_groq(vendor: str, user_categories: list[str]) -> str | None:
    """Dùng Groq suggest category phù hợp nhất cho vendor."""
    try:
        from groq import Groq
        groq_client = Groq(api_key=settings.groq_api_key)
        category_list = ", ".join(user_categories)
        prompt = (
            f'Tên cửa hàng: "{vendor}". Danh sách danh mục: [{category_list}].\n'
            f"Chọn danh mục phù hợp nhất. Chỉ trả về tên danh mục, không thêm gì khác."
        )
        r = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=30,
        )
        return r.choices[0].message.content.strip()
    except Exception:
        return None
