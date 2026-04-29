-- ========================================================
-- Script cập nhật DB cũ với cột mới cho recurring
-- Chạy cả khúc này một lần
-- ========================================================

USE finance_app;

-- Bước 1: Thêm các cột mới (nullable trước để tránh lỗi với dữ liệu cũ)
ALTER TABLE recurring_transactions
  ADD COLUMN start_date DATE NULL AFTER frequency,
  ADD COLUMN execution_time TIME NOT NULL DEFAULT '08:00:00' AFTER next_due_date,
  ADD COLUMN notification_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER end_date,
  ADD COLUMN remind_before_minutes INT NOT NULL DEFAULT 30 AFTER notification_enabled,
  ADD COLUMN last_notified_at DATETIME NULL AFTER remind_before_minutes;

-- Bước 2: Cập nhật start_date từ next_due_date (lấy giá trị từ next_due_date hoặc ngày hiện tại)
UPDATE recurring_transactions
SET start_date = IFNULL(next_due_date, CURDATE())
WHERE start_date IS NULL;

-- Bước 3: Đổi start_date thành NOT NULL
ALTER TABLE recurring_transactions
  MODIFY COLUMN start_date DATE NOT NULL;

-- Bước 4: Tạo bảng notifications (nếu chưa có)
CREATE TABLE IF NOT EXISTS notifications (
    id                CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
    user_id           CHAR(36)      NOT NULL,
    recurring_id      CHAR(36),
    title             VARCHAR(255)  NOT NULL,
    message           TEXT          NOT NULL,
    notification_type VARCHAR(20)   NOT NULL COMMENT 'reminder | due | overdue',
    scheduled_for     DATETIME      NOT NULL,
    is_read           TINYINT(1)    NOT NULL DEFAULT 0,
    read_at           DATETIME      NULL,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_recurring
        FOREIGN KEY (recurring_id) REFERENCES recurring_transactions(id) ON DELETE SET NULL,
    CONSTRAINT chk_notifications_type
        CHECK (notification_type IN ('reminder', 'due', 'overdue')),

    UNIQUE KEY uq_notifications_recurring_type_schedule (recurring_id, notification_type, scheduled_for),
    INDEX idx_notifications_user_id (user_id),
    INDEX idx_notifications_recurring_id (recurring_id),
    INDEX idx_notifications_is_read (is_read),
    INDEX idx_notifications_scheduled_for (scheduled_for)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Xong!
