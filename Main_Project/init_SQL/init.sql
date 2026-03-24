-- Hỗ trợ sinh UUID tự động (Cần thiết cho các phiên bản PostgreSQL cũ, PG 13+ thì có sẵn)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Bảng Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    is_notify_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tạo Index cho email để tối ưu tốc độ đăng nhập
CREATE INDEX idx_users_email ON users(email);


-- 2. Bảng Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL có nghĩa là danh mục hệ thống
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL -- 'INCOME' hoặc 'EXPENSE'
);


-- 3. Bảng Wallets
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    wallet_type VARCHAR(20) NOT NULL, -- 'CASH', 'CREDIT', 'LINKED_BANK'
    balance NUMERIC(15, 2) DEFAULT 0.00,
    bank_access_token VARCHAR(255)
);


-- 4. Bảng Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0), -- Ràng buộc tiền phải lớn hơn 0
    type VARCHAR(20) NOT NULL, -- 'INCOME' hoặc 'EXPENSE'
    trans_date TIMESTAMP WITH TIME ZONE NOT NULL,
    note TEXT,
    is_ai_generated BOOLEAN DEFAULT FALSE
);


-- 5. Bảng AIParsedLog
CREATE TABLE ai_parsed_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_input_text TEXT,
    raw_image_url VARCHAR(255),
    parsed_data JSONB NOT NULL, -- Cột lưu dữ liệu JSON của PostgreSQL
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'CONFIRMED', 'REJECTED'
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL 
    -- Dùng SET NULL để nếu giao dịch bị xóa, log AI vẫn còn lưu lại để thống kê độ chính xác của model
);


-- 6. Bảng Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);