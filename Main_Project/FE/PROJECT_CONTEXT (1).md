# PROJECT CONTEXT — Ứng dụng Quản lý Chi tiêu Cá nhân

> File này chứa toàn bộ ngữ cảnh dự án: yêu cầu nghiệp vụ, thiết kế dữ liệu, kiến trúc hệ thống và kế hoạch triển khai. Dùng để onboard Claude Code hoặc bất kỳ AI assistant nào tiếp tục phát triển dự án.

---

## 1. Tổng quan dự án

**Tên:** Personal Finance Manager — Ứng dụng Quản lý Chi tiêu Cá nhân  
**Mục tiêu:** Giúp người dùng ghi nhận, phân loại, phân tích dòng tiền cá nhân và nhận gợi ý tài chính thông minh từ AI.  
**Kiến trúc:** Monolithic  
**Đối tượng người dùng:** Cá nhân 18–45 tuổi, có thu nhập, muốn kiểm soát tài chính cá nhân.

---

## 2. Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | Vite (React) |
| Backend | FastAPI (Python) |
| Database | MySQL |
| ORM | SQLAlchemy |
| Validation | Pydantic v2 |
| Auth | JWT (access token + refresh token) |
| LLM API | Groq API (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`) |
| LLM fallback | Google AI Studio (Gemini) |
| OCR | Veryfi API (`app.veryfi.com`) |
| Package manager | pip + requirements.txt |

---

## 3. Yêu cầu bắt buộc (Minimum Viable Product)

Phần mềm phải đáp ứng 5 chức năng cốt lõi sau:

1. **Quản lý thu chi cá nhân:** nhập, chỉnh sửa và xoá các khoản thu và chi tiêu.
2. **Phân loại giao dịch theo danh mục:** ăn uống, di chuyển, giải trí, tiết kiệm, v.v.
3. **Thống kê trực quan:** biểu đồ thu – chi theo thời gian và theo danh mục.
4. **Tính toán số dư:** hiển thị tổng thu, tổng chi, số dư theo từng giai đoạn.
5. **Xác thực người dùng:** đăng ký, đăng nhập.

---

## 4. Yêu cầu đầy đủ theo nhóm tính năng

### 4.1 Xác thực & Tài khoản (AUTH)

- Đăng ký bằng email + password (bcrypt hash)
- Đăng nhập → trả về JWT access token + refresh token
- Middleware xác thực bảo vệ toàn bộ API
- Session timeout sau 60 phút không hoạt động
- (Mở rộng) Đăng nhập Google / Apple OAuth
- (Mở rộng) Xác thực 2 lớp (2FA via OTP)
- (Mở rộng) Khóa app bằng PIN / Face ID / Fingerprint

### 4.2 Quản lý Ví (WALLET)

Hệ thống có **2 loại ví**:

**Ví cơ bản (basic):**
- Người dùng tự nhập tay toàn bộ giao dịch
- Hoạt động offline
- Phù hợp cho tiền mặt, tài khoản không cần tự động sync

**Ví liên kết (linked):**
- Kết nối với ngân hàng, ví điện tử (MoMo, ZaloPay), thẻ tín dụng
- Tự động đồng bộ giao dịch qua API của nhà cung cấp (OAuth flow)
- Giao dịch kéo về có `source = auto_sync`, `is_reviewed = false`
- Người dùng cần review và gán danh mục trước khi tính vào báo cáo
- Mỗi giao dịch có `external_ref_id` để tránh import trùng
- Thông báo khi token hết hạn hoặc sync lỗi

**Nghiệp vụ chung cho cả 2 loại ví:**
- CRUD đầy đủ (tên, icon, màu, loại tiền tệ)
- Tính toán và cập nhật `balance` sau mỗi giao dịch (dùng DB transaction + row lock)
- Chuyển tiền nội bộ giữa các ví (ghi vào bảng TRANSFER riêng, không tính vào thu chi)
- Hiển thị tổng số dư gộp tất cả ví
- Ẩn/hiện ví trên dashboard

### 4.3 Quản lý Danh mục (CATEGORY)

- Hệ thống seed sẵn danh mục mặc định khi user đăng ký
- CRUD danh mục tùy chỉnh
- Hỗ trợ danh mục con (parent_id) — tối đa 2 cấp
- Mỗi danh mục có: tên, type (income/expense), icon, màu sắc
- Không cho xóa danh mục đang có giao dịch liên kết

### 4.4 Quản lý Giao dịch (TRANSACTION)

- CRUD giao dịch: số tiền, loại (income/expense), danh mục, ví, ngày giờ, ghi chú
- Đính kèm ảnh hóa đơn (upload + lưu URL)
- Tìm kiếm theo từ khóa
- Lọc theo: ví, danh mục, loại, khoảng thời gian
- Phân trang (pagination) bắt buộc
- Export CSV / PDF theo kỳ
- Giao dịch có trường `source`: `manual` hoặc `auto_sync`
- Giao dịch có trường `is_reviewed`: false với auto_sync, true với manual

### 4.5 Giao dịch định kỳ (RECURRING_TRANSACTION)

- Tạo template: số tiền, danh mục, ví, tần suất (daily/weekly/monthly/yearly), ngày bắt đầu, ngày kết thúc
- Background job chạy mỗi ngày kiểm tra các bản ghi đến hạn → tạo TRANSACTION thực sự
- Giao dịch được tạo tự động có `recurring_id` trỏ về template
- Người dùng có thể chỉnh sửa từng lần phát sinh độc lập với template

### 4.6 Chuyển khoản nội bộ (TRANSFER)

- Tạo bản ghi TRANSFER riêng biệt (không dùng TRANSACTION)
- Thực hiện trong 1 DB transaction: trừ ví nguồn + cộng ví đích
- Không được tính vào báo cáo thu-chi

### 4.7 Ngân sách (BUDGET)

- Đặt giới hạn chi tiêu theo danh mục, theo tháng
- Đặt ngân sách tổng toàn bộ chi tiêu trong tháng
- Tính `spent_amount` bằng aggregate realtime từ TRANSACTION
- Cảnh báo khi đạt 80% ngân sách (gửi NOTIFICATION)
- Thông báo khi vượt 100% ngân sách
- Chỉ gửi thông báo 1 lần cho mỗi ngưỡng trong 1 tháng
- (Mở rộng) Rollover: chuyển ngân sách dư sang tháng tiếp theo

### 4.8 Mục tiêu tiết kiệm (SAVINGS_GOAL)

- Tạo mục tiêu: tên, số tiền cần đạt, deadline, ví tích lũy
- Nạp tiền vào mục tiêu = TRANSFER từ ví thường sang ví mục tiêu
- Hiển thị tiến độ và tính toán số tiền cần để dành mỗi tháng: `(target - saved) / remaining_months`
- Thông báo khi đạt 100% mục tiêu
- status: `active` / `completed` / `cancelled`

### 4.9 Báo cáo & Thống kê (REPORT)

- Dashboard: tổng thu, tổng chi, số dư theo tuần/tháng/năm
- Pie chart: phân bổ chi tiêu theo danh mục
- Line chart: xu hướng thu-chi theo thời gian
- So sánh 2 kỳ (tháng này vs tháng trước)
- Top 5 danh mục chi tiêu lớn nhất
- Tỷ lệ tiết kiệm = `(income - expense) / income * 100`
- Loại trừ khỏi báo cáo: TRANSFER, TRANSACTION chưa reviewed (`is_reviewed = false`)
- Xử lý đệ quy danh mục con: tổng cha = tổng các con cộng lại

### 4.10 Thông báo (NOTIFICATION)

- Bảng NOTIFICATION lưu tất cả thông báo (polymorphic: source_type + source_id)
- Nguồn kích hoạt: BUDGET (80%/100%), SAVINGS_GOAL (completed), RECURRING (đến hạn), SYNC_LOG (lỗi)
- Kênh gửi theo thứ tự ưu tiên: In-app → Email (SMTP) → Push (FCM)
- Người dùng tùy chỉnh loại thông báo muốn nhận và khung giờ
- Không gửi lặp cho cùng một sự kiện

### 4.11 AI / NLP Features

**NLP nhập liệu tự nhiên:**
- Người dùng gõ: `"Hôm nay chi 50k ăn sáng"`
- BE gọi Groq API → trích xuất: amount, type, category, note, transacted_at
- Trả về JSON cho FE hiển thị xác nhận → người dùng bấm lưu

**Truy vấn ngôn ngữ tự nhiên:**
- Người dùng hỏi: `"Tôi chi bao nhiêu cho cà phê tháng 12?"`
- Bước 1: LLM extract params (category keyword, month, year, query_type)
- Bước 2: Chạy query thật từ DB
- Bước 3: LLM viết câu trả lời tự nhiên từ data thật

**OCR hóa đơn:**
- Người dùng upload ảnh receipt
- Gọi Veryfi API → nhận: total, date, vendor, line_items
- Gọi thêm LLM để map vendor name → danh mục của user
- Trả về kết quả cho FE xác nhận trước khi lưu

**Phân tích xu hướng & gợi ý:**
- Aggregate data 3 tháng gần nhất
- Gọi LLM model mạnh hơn (`llama-3.3-70b-versatile`)
- Nhận xét xu hướng + gợi ý cắt giảm cụ thể

**Anomaly Detection:**
- Dùng Z-score thống kê để phát hiện giao dịch bất thường (Z > 2.0)
- Group theo danh mục, cần ít nhất 3 điểm dữ liệu
- Dùng LLM viết thông báo dễ hiểu về bất thường phát hiện được

**Chatbot tài chính:**
- Conversation history lưu in-memory (user_id → list of messages)
- System prompt có ngữ cảnh tài chính của user (summary tháng hiện tại)
- Giữ tối đa 10 turns để tránh vượt context window
- Reset khi user bắt đầu session mới

---

## 5. Thiết kế Database (ERD)

### Danh sách các bảng và quan hệ

```
USER (1) ──< WALLET (nhiều)
USER (1) ──< CATEGORY (nhiều)
USER (1) ──< BUDGET (nhiều)
USER (1) ──< SAVINGS_GOAL (nhiều)
USER (1) ──< NOTIFICATION (nhiều)

WALLET (1) ──| LINKED_ACCOUNT (0 hoặc 1) — chỉ ví linked mới có
LINKED_ACCOUNT (1) ──< SYNC_LOG (nhiều)
LINKED_ACCOUNT (1) ──< TRANSACTION (nhiều) — auto_sync transactions

WALLET (1) ──< TRANSACTION (nhiều)
WALLET (1) ──< RECURRING_TRANSACTION (nhiều)
WALLET (1) ──< TRANSFER (nhiều) — as from_wallet
WALLET (1) ──< TRANSFER (nhiều) — as to_wallet
WALLET (1) ──| SAVINGS_GOAL (0 hoặc 1)

CATEGORY (1) ──< TRANSACTION (nhiều)
CATEGORY (1) ──< BUDGET (nhiều)
CATEGORY (1) ──< RECURRING_TRANSACTION (nhiều)
CATEGORY (1) ──< CATEGORY (nhiều) — self-referencing (subcategory)

RECURRING_TRANSACTION (1) ──< TRANSACTION (nhiều) — generated transactions

BUDGET ──< NOTIFICATION (trigger)
SAVINGS_GOAL ──< NOTIFICATION (trigger)
RECURRING_TRANSACTION ──< NOTIFICATION (trigger)
SYNC_LOG ──< NOTIFICATION (trigger)
```

### Schema chi tiết từng bảng

```sql
-- Người dùng
CREATE TABLE users (
    id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100),
    default_currency VARCHAR(10) DEFAULT 'VND',
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- Ví tiền
CREATE TABLE wallets (
    id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    user_id     CHAR(36)     NOT NULL REFERENCES users(id),
    name        VARCHAR(100) NOT NULL,
    wallet_type ENUM('basic','linked') NOT NULL DEFAULT 'basic',
    balance     DECIMAL(18,2) NOT NULL DEFAULT 0,
    currency    VARCHAR(10)  DEFAULT 'VND',
    icon        VARCHAR(50),
    color       VARCHAR(20),
    is_active   BOOLEAN      DEFAULT TRUE,
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- Tài khoản liên kết (chỉ ví loại linked)
CREATE TABLE linked_accounts (
    id                   CHAR(36)    PRIMARY KEY DEFAULT (UUID()),
    wallet_id            CHAR(36)    NOT NULL UNIQUE REFERENCES wallets(id),
    provider_name        VARCHAR(100) NOT NULL,
    provider_type        ENUM('bank','ewallet','card') NOT NULL,
    account_number_masked VARCHAR(20),
    access_token_enc     TEXT,       -- mã hóa AES-256 trước khi lưu
    refresh_token_enc    TEXT,
    sync_status          ENUM('active','paused','error') DEFAULT 'active',
    last_synced_at       DATETIME,
    token_expires_at     DATETIME
);

-- Lịch sử đồng bộ
CREATE TABLE sync_logs (
    id                    CHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    linked_account_id     CHAR(36)   NOT NULL REFERENCES linked_accounts(id),
    status                ENUM('success','failed','partial') NOT NULL,
    transactions_imported INT        DEFAULT 0,
    error_message         TEXT,
    synced_at             DATETIME   DEFAULT CURRENT_TIMESTAMP
);

-- Danh mục
CREATE TABLE categories (
    id         CHAR(36)    PRIMARY KEY DEFAULT (UUID()),
    user_id    CHAR(36)    NOT NULL REFERENCES users(id),
    parent_id  CHAR(36)    REFERENCES categories(id),  -- self-referencing
    name       VARCHAR(100) NOT NULL,
    type       ENUM('income','expense') NOT NULL,
    icon       VARCHAR(50),
    color      VARCHAR(20),
    is_default BOOLEAN     DEFAULT FALSE,
    is_active  BOOLEAN     DEFAULT TRUE
);

-- Giao dịch
CREATE TABLE transactions (
    id               CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    wallet_id        CHAR(36)     NOT NULL REFERENCES wallets(id),
    category_id      CHAR(36)     REFERENCES categories(id),
    linked_account_id CHAR(36)    REFERENCES linked_accounts(id),
    recurring_id     CHAR(36)     REFERENCES recurring_transactions(id),
    type             ENUM('income','expense') NOT NULL,
    amount           DECIMAL(18,2) NOT NULL,
    currency         VARCHAR(10)  DEFAULT 'VND',
    note             TEXT,
    source           ENUM('manual','auto_sync') DEFAULT 'manual',
    external_ref_id  VARCHAR(255), -- ID từ ngân hàng/provider, để chống trùng
    is_reviewed      BOOLEAN      DEFAULT TRUE, -- false nếu auto_sync chưa phân loại
    receipt_url      VARCHAR(500),
    transacted_at    DATETIME     NOT NULL,
    created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_external_ref (linked_account_id, external_ref_id)
);

-- Chuyển khoản nội bộ
CREATE TABLE transfers (
    id             CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    from_wallet_id CHAR(36)     NOT NULL REFERENCES wallets(id),
    to_wallet_id   CHAR(36)     NOT NULL REFERENCES wallets(id),
    amount         DECIMAL(18,2) NOT NULL,
    note           TEXT,
    transferred_at DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- Ngân sách
CREATE TABLE budgets (
    id           CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    user_id      CHAR(36)     NOT NULL REFERENCES users(id),
    category_id  CHAR(36)     REFERENCES categories(id),
    limit_amount DECIMAL(18,2) NOT NULL,
    month        TINYINT      NOT NULL,  -- 1–12
    year         SMALLINT     NOT NULL,
    rollover     BOOLEAN      DEFAULT FALSE,
    is_active    BOOLEAN      DEFAULT TRUE,
    UNIQUE KEY uq_budget (user_id, category_id, month, year)
);

-- Mục tiêu tiết kiệm
CREATE TABLE savings_goals (
    id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    user_id       CHAR(36)     NOT NULL REFERENCES users(id),
    wallet_id     CHAR(36)     REFERENCES wallets(id),
    name          VARCHAR(200) NOT NULL,
    target_amount DECIMAL(18,2) NOT NULL,
    saved_amount  DECIMAL(18,2) DEFAULT 0,
    deadline      DATE,
    status        ENUM('active','completed','cancelled') DEFAULT 'active',
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- Giao dịch định kỳ (template)
CREATE TABLE recurring_transactions (
    id           CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    wallet_id    CHAR(36)     NOT NULL REFERENCES wallets(id),
    category_id  CHAR(36)     REFERENCES categories(id),
    type         ENUM('income','expense') NOT NULL,
    amount       DECIMAL(18,2) NOT NULL,
    note         TEXT,
    frequency    ENUM('daily','weekly','monthly','yearly') NOT NULL,
    next_due_date DATE         NOT NULL,
    end_date     DATE,
    is_active    BOOLEAN      DEFAULT TRUE
);

-- Thông báo
CREATE TABLE notifications (
    id          CHAR(36)    PRIMARY KEY DEFAULT (UUID()),
    user_id     CHAR(36)    NOT NULL REFERENCES users(id),
    source_type ENUM('budget','goal','recurring','sync') NOT NULL,
    source_id   CHAR(36)    NOT NULL,  -- polymorphic FK
    message     TEXT        NOT NULL,
    is_read     BOOLEAN     DEFAULT FALSE,
    sent_at     DATETIME    DEFAULT CURRENT_TIMESTAMP
);
```

### Mermaid ERD (dán vào https://mermaid.live để xem)

```
erDiagram
  USER { uuid id PK; string email; string password_hash; string full_name; string default_currency; timestamp created_at }
  WALLET { uuid id PK; uuid user_id FK; string name; string wallet_type; decimal balance; string currency; string icon; string color; boolean is_active }
  LINKED_ACCOUNT { uuid id PK; uuid wallet_id FK; string provider_name; string provider_type; string account_number_masked; string access_token_enc; string refresh_token_enc; string sync_status; timestamp last_synced_at; timestamp token_expires_at }
  SYNC_LOG { uuid id PK; uuid linked_account_id FK; string status; int transactions_imported; string error_message; timestamp synced_at }
  CATEGORY { uuid id PK; uuid user_id FK; uuid parent_id FK; string name; string type; string icon; string color; boolean is_default; boolean is_active }
  TRANSACTION { uuid id PK; uuid wallet_id FK; uuid category_id FK; uuid linked_account_id FK; uuid recurring_id FK; string type; decimal amount; string currency; string note; string source; string external_ref_id; boolean is_reviewed; string receipt_url; timestamp transacted_at }
  TRANSFER { uuid id PK; uuid from_wallet_id FK; uuid to_wallet_id FK; decimal amount; string note; timestamp transferred_at }
  BUDGET { uuid id PK; uuid user_id FK; uuid category_id FK; decimal limit_amount; int month; int year; boolean rollover; boolean is_active }
  SAVINGS_GOAL { uuid id PK; uuid user_id FK; uuid wallet_id FK; string name; decimal target_amount; decimal saved_amount; date deadline; string status }
  RECURRING_TRANSACTION { uuid id PK; uuid wallet_id FK; uuid category_id FK; string type; decimal amount; string note; string frequency; date next_due_date; date end_date; boolean is_active }
  NOTIFICATION { uuid id PK; uuid user_id FK; string source_type; uuid source_id; string message; boolean is_read; timestamp sent_at }

  USER ||--o{ WALLET : "owns"
  USER ||--o{ CATEGORY : "creates"
  USER ||--o{ BUDGET : "sets"
  USER ||--o{ SAVINGS_GOAL : "sets"
  USER ||--o{ NOTIFICATION : "receives"
  WALLET ||--o| LINKED_ACCOUNT : "connected via"
  LINKED_ACCOUNT ||--o{ SYNC_LOG : "logs sync"
  LINKED_ACCOUNT ||--o{ TRANSACTION : "auto-imports"
  WALLET ||--o{ TRANSACTION : "contains"
  WALLET ||--o{ RECURRING_TRANSACTION : "schedules"
  WALLET ||--o{ TRANSFER : "sends"
  WALLET ||--o{ TRANSFER : "receives"
  WALLET ||--o| SAVINGS_GOAL : "accumulates into"
  CATEGORY ||--o{ TRANSACTION : "classifies"
  CATEGORY ||--o{ BUDGET : "limits spending"
  CATEGORY ||--o{ RECURRING_TRANSACTION : "classifies"
  CATEGORY ||--o{ CATEGORY : "has subcategory"
  RECURRING_TRANSACTION ||--o{ TRANSACTION : "generates"
  BUDGET ||--o{ NOTIFICATION : "triggers alert"
  SAVINGS_GOAL ||--o{ NOTIFICATION : "triggers alert"
  RECURRING_TRANSACTION ||--o{ NOTIFICATION : "sends reminder"
  SYNC_LOG ||--o{ NOTIFICATION : "sends error alert"
```

---

## 6. Cấu trúc thư mục dự án

```
project-root/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── config.py
│   ├── requirements.txt
│   ├── .env
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── wallet.py
│   │   ├── linked_account.py
│   │   ├── sync_log.py
│   │   ├── category.py
│   │   ├── transaction.py
│   │   ├── transfer.py
│   │   ├── budget.py
│   │   ├── savings_goal.py
│   │   ├── recurring_transaction.py
│   │   └── notification.py
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── wallet.py
│   │   ├── category.py
│   │   ├── transaction.py
│   │   ├── transfer.py
│   │   ├── budget.py
│   │   ├── savings_goal.py
│   │   └── ai.py
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── wallets.py
│   │   ├── categories.py
│   │   ├── transactions.py
│   │   ├── transfers.py
│   │   ├── budgets.py
│   │   ├── savings_goals.py
│   │   ├── reports.py
│   │   └── ai.py
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── wallet_service.py
│   │   ├── category_service.py
│   │   ├── transaction_service.py
│   │   ├── transfer_service.py
│   │   ├── budget_service.py
│   │   ├── savings_goal_service.py
│   │   ├── report_service.py
│   │   ├── ai_service.py
│   │   └── ocr_service.py
│   │
│   └── utils/
│       ├── dependencies.py    # get_current_user, get_db
│       └── security.py        # JWT helpers, bcrypt
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/               # Axios instances và API calls
        ├── components/
        ├── pages/
        └── stores/            # State management
```

---

## 7. Cấu hình môi trường (.env)

```bash
# Database
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/finance_app

# JWT
SECRET_KEY=your-secret-key-minimum-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# Groq (đăng ký tại console.groq.com — free tier)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# Google AI Studio (đăng ký tại aistudio.google.com — free tier)
GOOGLE_API_KEY=AIzaSyxxxxxxxxxxxxxxx

# Veryfi OCR (đăng ký tại app.veryfi.com — free tier ~100 req/month)
VERYFI_CLIENT_ID=xxxxx
VERYFI_CLIENT_SECRET=xxxxx
VERYFI_USERNAME=xxxxx
VERYFI_API_KEY=xxxxx

# App
APP_ENV=development
CORS_ORIGINS=http://localhost:5173
```

---

## 8. Dependencies chính (requirements.txt)

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.35
pymysql==1.1.1
alembic==1.13.3
pydantic[email]==2.9.0
pydantic-settings==2.5.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.12
groq==0.11.0
google-generativeai==0.8.3
veryfi==9.0.0
httpx==0.27.2
python-dotenv==1.0.1
```

---

## 9. Kế hoạch triển khai theo mức độ ưu tiên

### 🔴 Mức 1 — Nền tảng bắt buộc (Tuần 1–2)

**Mục tiêu:** Hệ thống CRUD cơ bản hoạt động end-to-end.

Các task cần hoàn thành theo thứ tự:

1. Khởi tạo project FastAPI, kết nối MySQL, cấu hình Alembic migration
2. Tạo model + schema + router cho `USER` — đăng ký, đăng nhập, JWT middleware
3. Tạo model + schema + router cho `WALLET` (type basic) — CRUD + tính balance
4. Seed data danh mục mặc định khi user đăng ký (income: Lương, Thưởng, Khác / expense: Ăn uống, Di chuyển, Giải trí, Mua sắm, Sức khỏe, Giáo dục, Tiết kiệm, Khác)
5. Tạo model + schema + router cho `CATEGORY` — CRUD + hỗ trợ parent_id
6. Tạo model + schema + router cho `TRANSACTION` — CRUD + cập nhật balance trong DB transaction
7. Tạo model + schema + router cho `TRANSFER` — tạo bản ghi + cập nhật 2 ví cùng lúc

**Điểm kỹ thuật quan trọng cần nhớ:**
- Luôn dùng `with_for_update()` khi đọc và cập nhật balance để tránh race condition
- Bọc toàn bộ logic tạo TRANSACTION (insert + update balance) trong một `db.begin()` block
- TRANSFER không tính vào báo cáo thu-chi — kiểm tra kỹ khi viết query aggregate

### 🟠 Mức 2 — Báo cáo & Dashboard (Tuần 3)

**Mục tiêu:** Người dùng thấy được số liệu có ý nghĩa.

1. Tổng thu, tổng chi, số dư theo kỳ (`func.sum`, `extract month/year`)
2. Breakdown chi tiêu theo danh mục — xử lý đệ quy danh mục con
3. So sánh 2 kỳ (tháng này vs tháng trước)
4. Top 5 danh mục chi tiêu lớn nhất
5. Tỷ lệ tiết kiệm = `(income - expense) / income * 100`
6. Lịch sử giao dịch có filter + search + pagination
7. Export CSV (dùng `csv` module Python thuần)

**Lưu ý:** Loại trừ khỏi mọi báo cáo: bảng TRANSFER, TRANSACTION có `is_reviewed = false`.

### 🟡 Mức 3 — NLP & OCR tích hợp AI (Tuần 4–5)

**Mục tiêu:** Tích hợp AI để tăng UX, giảm công nhập liệu.

**Tuần 4 — NLP nhập liệu (ưu tiên nhất, nhanh nhất):**

1. Cài Groq SDK, tạo `ai_service.py` với hàm `parse_natural_language_transaction()`
2. Tạo endpoint `POST /api/ai/parse-transaction` nhận `{"text": "..."}` → trả về JSON parsed
3. FE hiển thị form xác nhận với dữ liệu đã parse → người dùng bấm lưu → gọi API tạo transaction thông thường
4. Tạo endpoint `POST /api/ai/query` cho truy vấn ngôn ngữ tự nhiên (2-step: extract params → query DB → LLM trả lời)

**Tuần 5 — OCR hóa đơn:**

1. Đăng ký Veryfi, cài SDK, tạo `ocr_service.py` với hàm `parse_receipt()`
2. Tạo endpoint `POST /api/ai/ocr-receipt` nhận file upload (`UploadFile`)
3. Sau OCR, gọi thêm LLM để suggest danh mục từ tên vendor
4. Trả về kết quả xác nhận cho FE — không tự lưu

**System prompt mẫu cho NLP parse transaction:**
```
Bạn là trợ lý tài chính. Người dùng nhập câu mô tả giao dịch bằng tiếng Việt.
Trích xuất thông tin và trả về JSON (KHÔNG có text thêm):
{
  "amount": <số tiền VND, "50k"=50000, "1tr"=1000000>,
  "type": <"income" hoặc "expense">,
  "category": <tên từ danh sách: {categories}>,
  "note": <mô tả ngắn>,
  "transacted_at": <ISO8601 nếu có, null nếu không>
}
```

**Tham số model Groq khuyến nghị:**
- Parse/extract nhanh: `llama-3.1-8b-instant` — temperature=0, max_tokens=200
- Phân tích/insight: `llama-3.3-70b-versatile` — temperature=0.3, max_tokens=400

### 🔵 Mức 4 — Budget, Goal, Recurring, Notification (Tuần 6–7)

1. CRUD `BUDGET` + tính `spent_amount` realtime + trigger notification khi 80%/100%
2. CRUD `SAVINGS_GOAL` + logic nạp tiền + trigger notification khi hoàn thành
3. CRUD `RECURRING_TRANSACTION` template
4. Background job (dùng `APScheduler` hoặc `Celery` đơn giản) chạy mỗi ngày 7:00 sáng để tạo transaction từ recurring
5. Hệ thống NOTIFICATION: bảng + endpoint đọc/đánh dấu đã đọc + gửi in-app
6. (Mở rộng) Email notification qua SMTP (Resend hoặc Nodemailer)

**Cài APScheduler:**
```bash
pip install apscheduler
```

```python
# main.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def start_scheduler():
    scheduler.add_job(process_recurring_transactions, 'cron', hour=7, minute=0)
    scheduler.start()
```

### ⚫ Mức 5 — AI Phân tích nâng cao + Anomaly (Tuần 8)

1. `GET /api/ai/insights` — phân tích xu hướng 3 tháng + gợi ý tiết kiệm
2. `GET /api/ai/anomalies` — Z-score detection + LLM viết thông báo
3. `POST /api/ai/chat` — chatbot với conversation history in-memory

**Anomaly detection Z-score (không cần ML library):**
```python
import statistics

def detect_anomalies(transactions_by_category: dict) -> list:
    anomalies = []
    for category, amounts in transactions_by_category.items():
        if len(amounts) < 3:
            continue
        mean = statistics.mean(amounts)
        stdev = statistics.stdev(amounts)
        if stdev == 0:
            continue
        for amount in amounts:
            z = (amount - mean) / stdev
            if z > 2.0:
                anomalies.append({
                    "category": category,
                    "amount": amount,
                    "mean": round(mean),
                    "z_score": round(z, 2)
                })
    return anomalies
```

### ⚪ Mức 5b — Ví liên kết & Sync (Để sau cùng)

Để sau khi toàn bộ mức 1–4 đã ổn định và deploy.

1. LINKED_ACCOUNT: CRUD + mã hóa token trước khi lưu
2. OAuth flow với provider (demo: mock provider hoặc Plaid)
3. Background sync job: gọi provider API → kiểm tra `external_ref_id` → insert TRANSACTION với `source=auto_sync`, `is_reviewed=false`
4. Ghi SYNC_LOG sau mỗi lần sync
5. Màn hình review giao dịch tự động
6. Xử lý token hết hạn → refresh hoặc gửi notification yêu cầu re-auth

---

## 10. Các API Endpoints tổng hợp

```
# Auth
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

# Wallets
GET    /api/wallets
POST   /api/wallets
GET    /api/wallets/{id}
PUT    /api/wallets/{id}
DELETE /api/wallets/{id}

# Categories
GET    /api/categories
POST   /api/categories
PUT    /api/categories/{id}
DELETE /api/categories/{id}

# Transactions
GET    /api/transactions          # filter: wallet_id, category_id, type, date_from, date_to, source, is_reviewed
POST   /api/transactions
GET    /api/transactions/{id}
PUT    /api/transactions/{id}
DELETE /api/transactions/{id}
GET    /api/transactions/export   # CSV export

# Transfers
GET    /api/transfers
POST   /api/transfers

# Budgets
GET    /api/budgets               # filter: month, year
POST   /api/budgets
PUT    /api/budgets/{id}
DELETE /api/budgets/{id}

# Savings Goals
GET    /api/savings-goals
POST   /api/savings-goals
PUT    /api/savings-goals/{id}
POST   /api/savings-goals/{id}/deposit   # nạp tiền vào mục tiêu

# Reports
GET    /api/reports/summary       # ?month=12&year=2024
GET    /api/reports/by-category   # ?month=12&year=2024
GET    /api/reports/trend         # ?months=6
GET    /api/reports/compare       # ?month1=11&month2=12&year=2024

# Notifications
GET    /api/notifications
PATCH  /api/notifications/{id}/read
PATCH  /api/notifications/read-all

# AI
POST   /api/ai/parse-transaction  # NLP nhập liệu
POST   /api/ai/query              # Truy vấn tự nhiên
POST   /api/ai/ocr-receipt        # OCR hóa đơn
GET    /api/ai/insights           # Phân tích xu hướng
GET    /api/ai/anomalies          # Phát hiện bất thường
POST   /api/ai/chat               # Chatbot
```

---

## 11. Thứ tự ưu tiên thực tế để ra sản phẩm nhanh nhất

| Tuần | Nội dung | Kết quả có thể demo |
|---|---|---|
| 1–2 | Auth + Wallet + Category + Transaction CRUD | App nhập giao dịch cơ bản |
| 3 | Dashboard + Báo cáo + Export | Thống kê thu chi có ý nghĩa |
| 4 | NLP parse transaction | Nhập liệu bằng câu nói tự nhiên |
| 5 | OCR hóa đơn | Chụp bill → tự điền form |
| 6 | Budget + Savings Goal | Kiểm soát ngân sách |
| 7 | Notification + Recurring | App nhắc nhở định kỳ |
| 8 | Chatbot + Insights + Anomaly | Trợ lý AI phân tích tài chính |

---

## 12. Quy ước code

- **Không viết business logic trong router** — router chỉ nhận request, validate, gọi service
- **Mỗi service function là một unit độc lập** — dễ test, dễ tái sử dụng
- **Luôn dùng DB transaction** khi có nhiều thao tác DB liên quan (balance update, transfer)
- **Trả về 200/201 cho success** — 400 cho validation error, 401 cho auth error, 404 cho not found
- **LLM response luôn có fallback** — nếu parse JSON thất bại thì trả về lỗi rõ ràng, không crash app
- **Không tự lưu kết quả AI** — luôn trả về FE để user xác nhận trước
- **Prefix tất cả route với `/api/`** — để dễ phân tách khi deploy

---

*Context document được tổng hợp từ quá trình phân tích yêu cầu dự án. Cập nhật lần cuối: 2025.*
