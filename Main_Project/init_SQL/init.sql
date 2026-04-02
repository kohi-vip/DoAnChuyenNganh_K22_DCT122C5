-- =============================================================
-- Personal Finance Manager — MySQL Init Script
-- Tương thích: MySQL 8.0+
-- Khớp với ERD và SQLAlchemy models trong BE/app/models/
-- =============================================================

CREATE DATABASE IF NOT EXISTS finance_app
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE finance_app;

-- -------------------------------------------------------------
-- 1. USERS
-- Người dùng của hệ thống
-- -------------------------------------------------------------
CREATE TABLE users (
    id               CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
    email            VARCHAR(255) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    full_name        VARCHAR(100),
    default_currency VARCHAR(10)  NOT NULL DEFAULT 'VND',
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 2. WALLETS
-- Ví tiền của người dùng (chỉ loại basic)
-- wallet_type: 'basic'
-- -------------------------------------------------------------
CREATE TABLE wallets (
    id          CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
    user_id     CHAR(36)      NOT NULL,
    name        VARCHAR(100)  NOT NULL,
    wallet_type VARCHAR(20)   NOT NULL DEFAULT 'basic',
    balance     DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    currency    VARCHAR(10)   NOT NULL DEFAULT 'VND',
    icon        VARCHAR(50),
    color       VARCHAR(20),
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_wallets_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_wallets_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 3. CATEGORIES
-- Danh mục thu/chi, hỗ trợ 2 cấp (parent_id tự tham chiếu)
-- type: 'income' | 'expense'
-- -------------------------------------------------------------
CREATE TABLE categories (
    id         CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
    user_id    CHAR(36)     NOT NULL,
    parent_id  CHAR(36),
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(10)  NOT NULL  COMMENT 'income | expense',
    icon       VARCHAR(50),
    color      VARCHAR(20),
    is_default TINYINT(1)   NOT NULL DEFAULT 0,
    is_active  TINYINT(1)   NOT NULL DEFAULT 1,

    CONSTRAINT fk_categories_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT chk_categories_type
        CHECK (type IN ('income', 'expense')),

    INDEX idx_categories_user_id (user_id),
    INDEX idx_categories_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 4. RECURRING_TRANSACTIONS (tạo trước TRANSACTIONS vì TRANSACTIONS FK đến bảng này)
-- Template giao dịch định kỳ
-- type: 'income' | 'expense'
-- frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
-- -------------------------------------------------------------
CREATE TABLE recurring_transactions (
    id             CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
    wallet_id      CHAR(36)      NOT NULL,
    category_id    CHAR(36),
    type           VARCHAR(10)   NOT NULL  COMMENT 'income | expense',
    amount         DECIMAL(18,2) NOT NULL,
    note           TEXT,
    frequency      VARCHAR(20)   NOT NULL  COMMENT 'daily | weekly | monthly | yearly',
    next_due_date  DATE          NOT NULL,
    end_date       DATE,
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,

    CONSTRAINT fk_recurring_wallet
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
    CONSTRAINT fk_recurring_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT chk_recurring_type
        CHECK (type IN ('income', 'expense')),
    CONSTRAINT chk_recurring_frequency
        CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),

    INDEX idx_recurring_wallet_id (wallet_id),
    INDEX idx_recurring_next_due (next_due_date),
    INDEX idx_recurring_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 5. TRANSACTIONS
-- Giao dịch thu/chi thực tế
-- type: 'income' | 'expense'
-- source: 'manual' | 'auto_sync'
-- is_reviewed: dùng cho filter trong báo cáo (true = đã xác nhận)
-- -------------------------------------------------------------
CREATE TABLE transactions (
    id            CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
    wallet_id     CHAR(36)      NOT NULL,
    category_id   CHAR(36),
    recurring_id  CHAR(36),
    type          VARCHAR(10)   NOT NULL  COMMENT 'income | expense',
    amount        DECIMAL(18,2) NOT NULL,
    currency      VARCHAR(10)   NOT NULL DEFAULT 'VND',
    note          TEXT,
    source        VARCHAR(20)   NOT NULL DEFAULT 'manual'  COMMENT 'manual | auto_sync',
    is_reviewed   TINYINT(1)    NOT NULL DEFAULT 1         COMMENT 'false = chưa phân loại (auto_sync)',
    receipt_url   VARCHAR(500),
    transacted_at DATETIME      NOT NULL,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_transactions_wallet
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_transactions_recurring
        FOREIGN KEY (recurring_id) REFERENCES recurring_transactions(id) ON DELETE SET NULL,
    CONSTRAINT chk_transactions_type
        CHECK (type IN ('income', 'expense')),
    CONSTRAINT chk_transactions_source
        CHECK (source IN ('manual', 'auto_sync')),
    CONSTRAINT chk_transactions_amount
        CHECK (amount > 0),

    INDEX idx_transactions_wallet_id   (wallet_id),
    INDEX idx_transactions_category_id (category_id),
    INDEX idx_transactions_transacted_at (transacted_at),
    INDEX idx_transactions_type        (type),
    INDEX idx_transactions_is_reviewed (is_reviewed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 6. TRANSFERS
-- Chuyển khoản nội bộ giữa các ví (KHÔNG tính vào thu/chi)
-- -------------------------------------------------------------
CREATE TABLE transfers (
    id             CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
    from_wallet_id CHAR(36)      NOT NULL,
    to_wallet_id   CHAR(36)      NOT NULL,
    amount         DECIMAL(18,2) NOT NULL,
    note           TEXT,
    transferred_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_transfers_from_wallet
        FOREIGN KEY (from_wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
    CONSTRAINT fk_transfers_to_wallet
        FOREIGN KEY (to_wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
    CONSTRAINT chk_transfers_different_wallets
        CHECK (from_wallet_id <> to_wallet_id),
    CONSTRAINT chk_transfers_amount
        CHECK (amount > 0),

    INDEX idx_transfers_from_wallet (from_wallet_id),
    INDEX idx_transfers_to_wallet   (to_wallet_id),
    INDEX idx_transfers_transferred_at (transferred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================
-- SAMPLE / SEED DATA — dùng để test, chạy sau khi tạo tables
-- Tài khoản test: email=test@caisocai.vn  password=Test@1234
-- Hash được tạo bằng: python -c "from passlib.hash import bcrypt; print(bcrypt.hash('Test@1234'))"
-- Nếu hash bên dưới không khớp, chạy lệnh trên rồi thay thế giá trị trong INSERT users
-- =============================================================

-- -------------------------------------------------------------
-- USER MẪU
-- -------------------------------------------------------------
INSERT INTO users (id, email, password_hash, full_name, default_currency)
VALUES (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'test@caisocai.vn',
    -- bcrypt hash của "Test@1234" (rounds=12, generated by bcrypt lib)
    '$2b$12$7AbpzPlno.3KV5ilZG9hy.0oQmBcVpw7OfLMASDFvoRw2Ibylaub6',
    'Người Dùng Test',
    'VND'
);

-- -------------------------------------------------------------
-- WALLETS MẪU
-- -------------------------------------------------------------
INSERT INTO wallets (id, user_id, name, wallet_type, balance, currency, icon, color)
VALUES
    ('bbbbbbbb-0001-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', 'Tiền mặt',    'basic', 2500000.00,  'VND', 'wallet',  '#10b981'),
    ('bbbbbbbb-0001-0001-0001-000000000002', 'aaaaaaaa-0001-0001-0001-000000000001', 'Tài khoản NH','basic', 15000000.00, 'VND', 'bank',    '#2563eb'),
    ('bbbbbbbb-0001-0001-0001-000000000003', 'aaaaaaaa-0001-0001-0001-000000000001', 'Ví MoMo',     'basic', 800000.00,   'VND', 'mobile',  '#ec4899');

-- -------------------------------------------------------------
-- CATEGORIES MẪU — Chi tiêu (expense)
-- -------------------------------------------------------------
INSERT INTO categories (id, user_id, parent_id, name, type, icon, color, is_default)
VALUES
    -- Cha chi tiêu
    ('cccccccc-0001-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', NULL, 'Ăn uống',        'expense', 'utensils',   '#f97316', 1),
    ('cccccccc-0001-0001-0001-000000000002', 'aaaaaaaa-0001-0001-0001-000000000001', NULL, 'Di chuyển',       'expense', 'car',        '#0ea5e9', 1),
    ('cccccccc-0001-0001-0001-000000000003', 'aaaaaaaa-0001-0001-0001-000000000001', NULL, 'Mua sắm',         'expense', 'shopping',   '#8b5cf6', 1),
    ('cccccccc-0001-0001-0001-000000000004', 'aaaaaaaa-0001-0001-0001-000000000001', NULL, 'Hóa đơn & tiện ích','expense','bolt',     '#ef4444', 1),
    ('cccccccc-0001-0001-0001-000000000005', 'aaaaaaaa-0001-0001-0001-000000000001', NULL, 'Giải trí',        'expense', 'gamepad',    '#ec4899', 1),
    ('cccccccc-0001-0001-0001-000000000006', 'aaaaaaaa-0001-0001-0001-000000000001', NULL, 'Sức khỏe',        'expense', 'heart',      '#10b981', 1),
    -- Con của Ăn uống
    ('cccccccc-0002-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', 'cccccccc-0001-0001-0001-000000000001', 'Ăn sáng',   'expense', 'coffee',  '#f97316', 0),
    ('cccccccc-0002-0001-0001-000000000002', 'aaaaaaaa-0001-0001-0001-000000000001', 'cccccccc-0001-0001-0001-000000000001', 'Ăn trưa',   'expense', 'sun',     '#f97316', 0),
    ('cccccccc-0002-0001-0001-000000000003', 'aaaaaaaa-0001-0001-0001-000000000001', 'cccccccc-0001-0001-0001-000000000001', 'Ăn tối',    'expense', 'moon',    '#f97316', 0),
    -- Con của Di chuyển
    ('cccccccc-0002-0002-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', 'cccccccc-0001-0001-0001-000000000002', 'Xăng xe',   'expense', 'fuel',    '#0ea5e9', 0),
    ('cccccccc-0002-0002-0001-000000000002', 'aaaaaaaa-0001-0001-0001-000000000001', 'cccccccc-0001-0001-0001-000000000002', 'Grab/taxi', 'expense', 'taxi',    '#0ea5e9', 0);

-- -------------------------------------------------------------
-- CATEGORIES MẪU — Thu nhập (income)
-- -------------------------------------------------------------
INSERT INTO categories (id, user_id, parent_id, name, type, icon, color, is_default)
VALUES
    ('cccccccc-0003-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', NULL, 'Lương',           'income', 'briefcase', '#10b981', 1),
    ('cccccccc-0003-0001-0001-000000000002', 'aaaaaaaa-0001-0001-0001-000000000001', NULL, 'Thưởng',          'income', 'gift',      '#10b981', 1),
    ('cccccccc-0003-0001-0001-000000000003', 'aaaaaaaa-0001-0001-0001-000000000001', NULL, 'Đầu tư',          'income', 'trending',  '#2563eb', 1),
    ('cccccccc-0003-0001-0001-000000000004', 'aaaaaaaa-0001-0001-0001-000000000001', NULL, 'Thu nhập khác',   'income', 'plus',      '#64748b', 1);

-- -------------------------------------------------------------
-- TRANSACTIONS MẪU — 3 tháng gần nhất
-- -------------------------------------------------------------
INSERT INTO transactions (id, wallet_id, category_id, type, amount, currency, note, source, is_reviewed, transacted_at)
VALUES
    -- Tháng 4/2026
    ('dddddddd-0001-0001-0001-000000000001', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0003-0001-0001-000000000001', 'income',  12000000, 'VND', 'Lương tháng 4',         'manual', 1, '2026-04-01 08:00:00'),
    ('dddddddd-0001-0001-0001-000000000002', 'bbbbbbbb-0001-0001-0001-000000000001', 'cccccccc-0002-0001-0001-000000000002', 'expense',   45000, 'VND', 'Ăn trưa cơm văn phòng', 'manual', 1, '2026-04-01 12:30:00'),
    ('dddddddd-0001-0001-0001-000000000003', 'bbbbbbbb-0001-0001-0001-000000000001', 'cccccccc-0002-0002-0001-000000000001', 'expense',   80000, 'VND', 'Xăng xe',               'manual', 1, '2026-04-02 07:15:00'),
    ('dddddddd-0001-0001-0001-000000000004', 'bbbbbbbb-0001-0001-0001-000000000003', 'cccccccc-0001-0001-0001-000000000005', 'expense',  150000, 'VND', 'Netflix tháng 4',        'manual', 1, '2026-04-02 20:00:00'),
    ('dddddddd-0001-0001-0001-000000000005', 'bbbbbbbb-0001-0001-0001-000000000001', 'cccccccc-0002-0001-0001-000000000002', 'expense',   55000, 'VND', 'Cơm trưa + trà sữa',    'manual', 1, '2026-04-03 12:00:00'),
    ('dddddddd-0001-0001-0001-000000000006', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0001-0001-0001-000000000004', 'expense',  320000, 'VND', 'Hóa đơn điện tháng 4',  'manual', 1, '2026-04-03 09:00:00'),

    -- Tháng 3/2026
    ('dddddddd-0002-0001-0001-000000000001', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0003-0001-0001-000000000001', 'income',  12000000, 'VND', 'Lương tháng 3',         'manual', 1, '2026-03-01 08:00:00'),
    ('dddddddd-0002-0001-0001-000000000002', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0003-0001-0001-000000000002', 'income',   2000000, 'VND', 'Thưởng quý 1',          'manual', 1, '2026-03-15 09:00:00'),
    ('dddddddd-0002-0001-0001-000000000003', 'bbbbbbbb-0001-0001-0001-000000000001', 'cccccccc-0002-0001-0001-000000000002', 'expense',   40000, 'VND', 'Ăn trưa',               'manual', 1, '2026-03-05 12:00:00'),
    ('dddddddd-0002-0001-0001-000000000004', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0001-0001-0001-000000000003', 'expense',  550000, 'VND', 'Mua quần áo',           'manual', 1, '2026-03-10 15:30:00'),
    ('dddddddd-0002-0001-0001-000000000005', 'bbbbbbbb-0001-0001-0001-000000000001', 'cccccccc-0002-0002-0001-000000000001', 'expense',   75000, 'VND', 'Đổ xăng',               'manual', 1, '2026-03-12 08:00:00'),
    ('dddddddd-0002-0001-0001-000000000006', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0001-0001-0001-000000000006', 'expense',  200000, 'VND', 'Khám bệnh',             'manual', 1, '2026-03-18 10:00:00'),
    ('dddddddd-0002-0001-0001-000000000007', 'bbbbbbbb-0001-0001-0001-000000000003', 'cccccccc-0001-0001-0001-000000000005', 'expense',  120000, 'VND', 'Spotify + YouTube',     'manual', 1, '2026-03-20 20:00:00'),
    ('dddddddd-0002-0001-0001-000000000008', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0001-0001-0001-000000000004', 'expense',  310000, 'VND', 'Hóa đơn điện tháng 3',  'manual', 1, '2026-03-22 09:00:00'),

    -- Tháng 2/2026
    ('dddddddd-0003-0001-0001-000000000001', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0003-0001-0001-000000000001', 'income',  12000000, 'VND', 'Lương tháng 2',         'manual', 1, '2026-02-01 08:00:00'),
    ('dddddddd-0003-0001-0001-000000000002', 'bbbbbbbb-0001-0001-0001-000000000001', 'cccccccc-0002-0001-0001-000000000001', 'expense',   35000, 'VND', 'Ăn sáng bánh mì',       'manual', 1, '2026-02-05 07:30:00'),
    ('dddddddd-0003-0001-0001-000000000003', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0001-0001-0001-000000000003', 'expense',  900000, 'VND', 'Mua đồ điện tử',        'manual', 1, '2026-02-14 16:00:00'),
    ('dddddddd-0003-0001-0001-000000000004', 'bbbbbbbb-0001-0001-0001-000000000001', 'cccccccc-0002-0002-0001-000000000002', 'expense',   95000, 'VND', 'Grab đi làm',           'manual', 1, '2026-02-20 08:30:00'),
    ('dddddddd-0003-0001-0001-000000000005', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0001-0001-0001-000000000004', 'expense',  290000, 'VND', 'Hóa đơn điện tháng 2',  'manual', 1, '2026-02-22 09:00:00'),
    ('dddddddd-0003-0001-0001-000000000006', 'bbbbbbbb-0001-0001-0001-000000000002', 'cccccccc-0003-0001-0001-000000000003', 'income',   500000, 'VND', 'Lãi gửi tiết kiệm',     'manual', 1, '2026-02-28 10:00:00');
