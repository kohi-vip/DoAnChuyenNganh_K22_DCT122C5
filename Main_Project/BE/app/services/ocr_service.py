import json
from decimal import Decimal
from fastapi import UploadFile, HTTPException
from app.config import get_settings
from app.schemas.ai import OCRReceiptResponse

settings = get_settings()


async def parse_receipt(file: UploadFile, user_categories: list[str]) -> OCRReceiptResponse:
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

    # Extract fields
    amount = result.get("total", None)
    date = result.get("date", None)
    vendor = result.get("vendor", {}).get("name") if isinstance(result.get("vendor"), dict) else result.get("vendor_name")
    line_items = result.get("line_items", [])

    # Use LLM to suggest category from vendor name
    suggested_category = None
    if vendor and user_categories:
        try:
            from groq import Groq
            groq_client = Groq(api_key=settings.groq_api_key)
            category_list = ", ".join(user_categories)
            prompt = f"""Tên cửa hàng: "{vendor}". Danh sách danh mục: [{category_list}].
Chọn danh mục phù hợp nhất cho hóa đơn này. Chỉ trả về tên danh mục, không thêm gì khác."""
            r = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=30,
            )
            suggested_category = r.choices[0].message.content.strip()
        except Exception:
            pass

    return OCRReceiptResponse(
        amount=Decimal(str(amount)) if amount else None,
        date=str(date) if date else None,
        vendor=vendor,
        suggested_category=suggested_category,
        line_items=line_items if isinstance(line_items, list) else [],
        raw_data={k: v for k, v in result.items() if k not in ("line_items",)},
    )
