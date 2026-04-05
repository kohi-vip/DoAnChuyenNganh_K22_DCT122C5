# Tích hợp AI — Tài liệu kỹ thuật & Hướng dẫn khởi động

> Cập nhật: 2026-04-05 | Branch: `AI_tech`

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Các thay đổi BE (FastAPI)](#2-các-thay-đổi-be-fastapi)
3. [Các thay đổi FE (React + Vite)](#3-các-thay-đổi-fe-react--vite)
4. [Hướng dẫn khởi động hệ thống](#4-hướng-dẫn-khởi-động-hệ-thống)
5. [Cấu hình biến môi trường](#5-cấu-hình-biến-môi-trường)
6. [Luồng dữ liệu chi tiết](#6-luồng-dữ-liệu-chi-tiết)
7. [Tính năng đã hoàn thành / còn lại](#7-tính-năng-đã-hoàn-thành--còn-lại)

---

## 1. Tổng quan kiến trúc

```
FE (React)
  │
  ├── /ai-assistant → Tab: Trợ lý Jelly
  │     └─ POST /api/ai/jelly-chat ─────────────────────────────┐
  │                                                              │
  ├── /ai-assistant → Tab: OCR Hóa đơn                         │
  │     └─ POST /api/ai/ocr-receipt (multipart)                 │
  │                                                              ▼
  └── /ai-assistant → Tab: Phân tích AI             BE (FastAPI)
        ├─ GET /api/ai/insights                          │
        └─ GET /api/ai/anomalies                         ├── Jelly proxy ──► n8n webhook
                                                         │     • inject context tài chính
                                                         │     • parse NDJSON streaming
                                                         │
                                                         ├── OCR (Veryfi SDK)
                                                         ├── Insights (Groq AI)
                                                         └── Anomalies (Z-score + Groq)

n8n (Docker):
  Chat Trigger → Inject context → [hasImage?]
      ├─ YES → OCR_tool (Veryfi HTTP) → Parse → Information Agent (Groq LLaMA)
      └─ NO  → Information Agent (Groq LLaMA)
```

---

## 2. Các thay đổi BE (FastAPI)

### 2.1 `core/config.py`

Thêm field `n8n_webhook_url`:

```python
class Settings(BaseSettings):
    # ... các field cũ ...
    n8n_webhook_url: str = ""          # ← THÊM MỚI
```

### 2.2 `schemas/ai.py`

Thêm 2 schema mới ở cuối file:

```python
class JellyChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    image_base64: str | None = None    # base64 thuần, không có prefix data:...
    image_name: str | None = None
    image_mime_type: str | None = None

class JellyChatResponse(BaseModel):
    session_id: str
    reply: str
```

### 2.3 `services/ai_service.py`

**Imports thêm:**
```python
import httpx
from fastapi import HTTPException
from finance_svc.schemas.ai import JellyChatRequest, JellyChatResponse  # trong import block cũ
```

**Hàm mới `_build_user_financial_context(db, user_id)`:**
- Truy vấn tháng này + tháng trước: tổng thu, tổng chi, số dư
- Breakdown **toàn bộ danh mục** chi tiêu và thu nhập theo tháng (không giới hạn top 3)
- 10 giao dịch gần nhất với format: `dd/MM Thu/Chi số_tiền — danh_mục (ghi chú)`
- Trả về dict dùng chung cho cả `chat()` và `jelly_chat()`

**Hàm `chat()` — cập nhật system prompt:**
- Gọi `_build_user_financial_context()` để lấy dữ liệu thực của user
- System prompt chứa đầy đủ: tháng này + tháng trước (breakdown danh mục) + 10 giao dịch gần nhất
- Model: `llama-3.3-70b-versatile` (Groq)

**Hàm mới `async jelly_chat()`:**
```
jelly_chat(db, user_id, message, session_id, image_base64, image_name, image_mime_type)
```
- Kiểm tra `N8N_WEBHOOK_URL` có được cấu hình không (503 nếu thiếu)
- Build `context_block` gồm dữ liệu tài chính + câu hỏi người dùng
- Gửi payload JSON sang n8n:
  ```json
  {
    "action": "sendMessage",
    "sessionId": "<uuid>",
    "chatInput": "<context_block + câu hỏi>",
    "image": { "name": "...", "mimeType": "image/jpeg", "data": "<base64>" }
  }
  ```
- Timeout: 90 giây (httpx AsyncClient)
- **Parser NDJSON** (n8n streaming format):
  - `type: "begin"` → bỏ qua (metadata)
  - `type: "item"` + `content: string` → nối vào `text_chunks` (**event chính**)
  - `type: "end"` → kiểm tra các key `output/text/response/message` (fallback)
  - Fallback: `text`, `token`, `output`, `message`, `response`
  - Cuối: `reply = "".join(text_chunks)` hoặc `final_output`
- Lỗi: 504 (timeout), 502 (HTTP error), 503 (n8n chưa cấu hình)

### 2.4 `views/ai.py`

Thêm endpoint mới:

```python
@router.post("/jelly-chat", response_model=JellyChatResponse)
async def jelly_chat(
    data: JellyChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ai_service.jelly_chat(
        db, current_user.id, data.message, data.session_id,
        data.image_base64, data.image_name, data.image_mime_type,
    )
```

### 2.5 Danh sách API AI đầy đủ

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/api/ai/jelly-chat` | **MỚI** — Proxy sang n8n Jelly (có image support) |
| `POST` | `/api/ai/ocr-receipt` | OCR hóa đơn qua Veryfi (multipart/form-data) |
| `GET`  | `/api/ai/insights` | Phân tích xu hướng 3 tháng (Groq) |
| `GET`  | `/api/ai/anomalies` | Phát hiện chi tiêu bất thường (Z-score + Groq) |
| `POST` | `/api/ai/chat` | Chat Groq trực tiếp (không qua n8n) |
| `POST` | `/api/ai/parse-transaction` | Parse giao dịch từ text tự nhiên |
| `POST` | `/api/ai/query` | Truy vấn DB bằng ngôn ngữ tự nhiên |

---

## 3. Các thay đổi FE (React + Vite)

### 3.1 `src/App.jsx`

```jsx
import AIPage from "./pages/AIPage";
// ...
<Route path="/ai-assistant" element={<AIPage />} />
```

### 3.2 `src/components/management/ManagementSidebar.jsx`

```js
{ id: "ai", label: "Trợ lý AI Jelly", icon: Bot, path: "/ai-assistant" }
```

### 3.3 `src/api/financeApi.js` — Các hàm mới

```js
// Chuyển File → base64 thuần (private helper)
const fileToBase64 = (file) => new Promise(...)

// POST /api/ai/jelly-chat — timeout 90s
export const jellyChat = async ({ message, sessionId, imageFile }) => { ... }

// POST /api/ai/ocr-receipt — multipart, timeout 60s
export const ocrReceipt = async (file) => { ... }

// GET /api/ai/insights — timeout 30s
export const fetchAiInsights = async () => { ... }

// GET /api/ai/anomalies — timeout 30s
export const fetchAiAnomalies = async () => { ... }
```

### 3.4 File mới: `src/pages/AIPage.jsx`

- Layout 3 tab: **Trợ lý Jelly** | **OCR Hóa đơn** | **Phân tích AI**
- Tab bar responsive (icon ẩn label trên màn hình nhỏ)
- `handlePrefillTransaction` callback (hiện tại `alert()` — TODO Phase 3: lift lên MainLayout)

### 3.5 File mới: `src/components/ai/JellyChatTab.jsx`

| Feature | Chi tiết |
|---------|---------|
| Welcome message | Hiển thị khi load lần đầu |
| ChatBubble | User (xanh, phải) / Jelly (trắng, trái + icon Bot) |
| TypingIndicator | 3 chấm bouncing khi đang chờ |
| Image attach | 1 ảnh/lần, preview thumbnail + nút X xóa |
| Session persist | `sessionId` giữ nguyên trong tab (reset khi reload) |
| Keyboard | Enter gửi, Shift+Enter xuống dòng |
| Auto-scroll | Cuộn xuống cuối khi có tin mới |

### 3.6 File mới: `src/components/ai/OcrTab.jsx`

- Drag & drop + click to upload (jpg/png/webp, tối đa 10MB)
- Preview ảnh h-28 × w-28 + nút X xóa
- Nút "Quét hóa đơn" → POST `/api/ai/ocr-receipt`
- Hiển thị kết quả: vendor, tổng tiền, ngày, danh mục gợi ý, line items
- Nút "Thêm giao dịch từ hóa đơn này" → gọi callback `onPrefillTransaction`

### 3.7 File mới: `src/components/ai/InsightsTab.jsx`

- Auto-load khi mount: `fetchAiInsights()` + `fetchAiAnomalies()` song song
- Section "Phân tích xu hướng": analysis text + numbered suggestions
- Section "Cảnh báo bất thường": Z-score badge, amount vs mean, description
- Loading spinner + error + nút thử lại mỗi section

---

## 4. Hướng dẫn khởi động hệ thống

### Thứ tự khởi động khuyến nghị:
```
1. MySQL (XAMPP)  →  2. n8n (Docker)  →  3. BE (FastAPI)  →  4. FE (Vite)
```

---

### Bước 1 — Khởi động MySQL (XAMPP)

1. Mở **XAMPP Control Panel**
2. Nhấn **Start** tại dòng **MySQL**
3. Đảm bảo cổng **3306** xanh (running)
4. Kiểm tra DB `finance_app` đã tồn tại (phpMyAdmin tại `http://localhost/phpmyadmin`)

---

### Bước 2 — Khởi động n8n bằng Docker

#### Lần đầu (tạo container):

```bash
docker run -d \
  --name n8n-finance \
  --restart unless-stopped \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=false \
  -e GENERIC_TIMEZONE=Asia/Ho_Chi_Minh \
  docker.n8n.io/n8nio/n8n
```

#### Các lần sau (container đã tạo):

```bash
docker start n8n-finance
```

#### Kiểm tra:

```bash
docker ps | grep n8n-finance
```

n8n UI: `http://localhost:5678`

#### Import workflow (chỉ làm 1 lần):

1. Mở `http://localhost:5678`
2. Vào **Workflows → Import from File**
3. Chọn file: `Test_AI_OCR/n8n to interface.json`
4. Nhấn **Activate** (toggle góc phải trên)
5. Click vào node **"When chat message received"** → copy **Webhook URL**
6. Dán URL vào `.env`:
   ```
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/<uuid>/chat
   ```

#### Cấu hình credentials trong n8n:

- **Groq**: Vào Settings → Credentials → New → Groq → nhập `GROQ_API_KEY`
- **Veryfi** (nếu workflow dùng): nhập Client ID, Secret, Username, API Key

---

### Bước 3 — Khởi động BE (FastAPI)

```bash
cd Main_Project/BE

# Lần đầu — tạo virtual env và cài dependencies
python -m venv venv
source venv/Scripts/activate        # Windows Git Bash
# hoặc: .\venv\Scripts\activate     # Windows CMD/PowerShell
pip install -r requirements.txt

# Chạy dev server (auto-reload)
uvicorn finance_svc.main:app --reload --host 0.0.0.0 --port 8000
```

Kiểm tra: `http://localhost:8000/docs` (Swagger UI)

**Lưu ý quan trọng:**
- BE phải chạy với `--reload` để tự động cập nhật khi sửa code
- Đảm bảo file `.env` ở đúng thư mục `Main_Project/BE/.env`
- Nếu lỗi `ModuleNotFoundError`: kiểm tra `venv` đang active

---

### Bước 4 — Khởi động FE (React + Vite)

```bash
cd Main_Project/FE

# Lần đầu
npm install

# Chạy dev server
npm run dev
```

FE chạy tại: `http://localhost:5173`

---

### Kiểm tra toàn bộ hệ thống:

| Dịch vụ | URL | Trạng thái mong đợi |
|---------|-----|---------------------|
| MySQL | `localhost:3306` | XAMPP xanh |
| n8n | `http://localhost:5678` | Workflow Active |
| BE | `http://localhost:8000/docs` | Swagger UI load được |
| FE | `http://localhost:5173` | App load được |

**Luồng test nhanh:**
1. Đăng nhập FE → vào **Trợ lý AI Jelly**
2. Tab **Trợ lý Jelly**: nhập câu hỏi → đợi tối đa 30s → Jelly trả lời
3. Tab **OCR Hóa đơn**: upload ảnh hóa đơn → nhấn "Quét" → xem kết quả
4. Tab **Phân tích AI**: tự động load → xem insights + cảnh báo

---

## 5. Cấu hình biến môi trường

File: `Main_Project/BE/.env`

```env
# Database
DATABASE_URL=mysql+pymysql://root:@localhost:3306/finance_app

# JWT
SECRET_KEY=finance-app-secret-key-minimum-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# Groq AI (chat + insights + anomalies)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Veryfi OCR (tab OCR hóa đơn)
VERYFI_CLIENT_ID=vrfABzyxjkGPx9xnXWCJrvyFdEmuhFOsalZjyWU
VERYFI_CLIENT_SECRET=<lấy từ Veryfi dashboard>
VERYFI_USERNAME=<email đăng ký Veryfi>
VERYFI_API_KEY=<lấy từ Veryfi dashboard>

# n8n Jelly chatbot webhook
# Lấy URL sau khi import workflow và activate trong n8n
N8N_WEBHOOK_URL=http://localhost:5678/webhook/<uuid>/chat

# App
APP_ENV=development
CORS_ORIGINS=http://localhost:5173
```

**Lưu ý:** Không có dấu cách sau dấu `=` (đặc biệt `N8N_WEBHOOK_URL`).

---

## 6. Luồng dữ liệu chi tiết

### 6.1 Jelly Chat (có ảnh)

```
FE JellyChatTab
  └─ chọn ảnh → previewUrl (createObjectURL)
  └─ nhấn Send
       ├─ fileToBase64(file) → base64 string
       └─ jellyChat({ message, sessionId, imageFile })
            └─ POST /api/ai/jelly-chat
                 { message, session_id, image_base64, image_name, image_mime_type }

BE jelly_chat()
  ├─ _build_user_financial_context() → lấy tháng này + tháng trước + 10 txn gần nhất
  ├─ Tạo context_block = [DỮ LIỆU TÀI CHÍNH] + [CÂU HỎI]
  ├─ POST n8n webhook với payload { action, sessionId, chatInput, image? }
  └─ Parse NDJSON response:
       • type:"begin" → skip
       • type:"item" content:"..." → nối text_chunks  ← EVENT CHÍNH
       • type:"end" → kiểm tra fallback output
       → reply = "".join(text_chunks)

FE ← { session_id, reply }
  └─ Hiển thị ChatBubble assistant với reply
```

### 6.2 OCR Hóa đơn

```
FE OcrTab
  └─ upload / drag & drop ảnh
  └─ nhấn "Quét hóa đơn"
       └─ ocrReceipt(file) → POST /api/ai/ocr-receipt (multipart)

BE ocr_service.parse_receipt()
  ├─ Gọi Veryfi SDK: process_document_url() với file bytes
  └─ Parse kết quả: vendor, amount, date, line_items
       └─ Groq suggest category dựa vào vendor + user categories

FE ← { vendor, amount, date, suggested_category, line_items }
  └─ Hiển thị InfoRow + line items table
  └─ Nút "Thêm giao dịch" → onPrefillTransaction callback
```

### 6.3 Phân tích AI (Insights + Anomalies)

```
FE InsightsTab (useEffect on mount)
  ├─ fetchAiInsights() → GET /api/ai/insights
  │    └─ Groq phân tích 3 tháng gần nhất → { analysis, suggestions, period }
  └─ fetchAiAnomalies() → GET /api/ai/anomalies
       └─ Z-score trên từng danh mục → Groq viết mô tả
       → { anomalies: [...], total_found }
```

---

## 7. Tính năng đã hoàn thành / còn lại

### Đã hoàn thành (Phase 1 & 2)

- [x] BE proxy endpoint `/api/ai/jelly-chat` → n8n
- [x] Context tài chính inject vào mỗi request (tháng này + tháng trước + 10 txn)
- [x] NDJSON parser cho n8n streaming response (type:item → content)
- [x] Image support: base64 trong JellyChatRequest → n8n payload
- [x] OCR tab: Veryfi SDK, category suggestion, line items
- [x] Insights tab: Groq phân tích xu hướng + suggestions
- [x] Anomalies tab: Z-score detection + Groq description
- [x] FE AIPage với 3 tab, routing `/ai-assistant`
- [x] JellyChatTab: session persist, image preview, auto-scroll, typing indicator
- [x] OcrTab: drag & drop, file preview, remove, prefill callback
- [x] InsightsTab: auto-load, error/retry per section

### Còn lại (Phase 3)

- [ ] **OCR → CreateTransactionDrawer prefill**: lift `handlePrefillTransaction` từ `AIPage` lên `MainLayout` để mở drawer với data prefill thật (hiện tại chỉ `alert()`)
- [ ] **Docker Compose hoàn chỉnh**: package n8n + workflow auto-import + credential injection qua env var
- [ ] **n8n OCR qua BE**: khi n8n gọi Veryfi trực tiếp bị lỗi → thay bằng BE làm OCR trước, embed text vào message gửi n8n
- [ ] **System prompt Phase 3**: thêm ngân sách (budget) và mục tiêu tiết kiệm vào context khi tính năng đó có trong DB
