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
