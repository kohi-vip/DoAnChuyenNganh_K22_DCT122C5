/**
 * financeApi.js
 * Tất cả các lời gọi API liên quan đến dữ liệu tài chính:
 * ví, danh mục, giao dịch.
 * Mỗi hàm chuẩn hoá (normalize) dữ liệu trả về về định dạng FE dùng.
 */
import httpClient from "./httpClient";

// ─────────────────────────────────────────────
// NORMALIZE HELPERS
// ─────────────────────────────────────────────

/** BE wallet → FE wallet */
const normalizeWallet = (w) => ({
  id: w.id,
  name: w.name,
  balance: Number(w.balance ?? 0),
  color: w.color || "#2563eb",
  type: w.wallet_type || "basic",
  currency: w.currency || "VND",
  icon: w.icon || "wallet",
  is_active: w.is_active ?? true,
});

/** BE category (đã có children[]) → FE category */
const normalizeCategory = (c) => ({
  id: c.id,
  name: c.name,
  type: c.type,
  color: c.color || "#94a3b8",
  icon: c.icon || "default",
  badge: c.is_default ? "Mặc định" : "Tùy chỉnh",
  is_default: c.is_default ?? false,
  is_active: c.is_active ?? true,
  children: (c.children || []).map((ch) => ({
    id: ch.id,
    name: ch.name,
    color: ch.color || c.color || "#94a3b8",
    icon: ch.icon || "default",
    is_active: ch.is_active ?? true,
  })),
});

/** BE transaction → FE transaction */
const normalizeTransaction = (t) => ({
  id: t.id,
  // BE không có trường `name` riêng, dùng note làm tên hiển thị
  name: t.note || "Giao dịch",
  description: t.note || "",
  date: t.transacted_at,
  transacted_at: t.transacted_at,
  amount: Number(t.amount ?? 0),
  type: t.type,
  walletId: t.wallet_id,
  categoryId: t.category_id || null,
  recurringId: t.recurring_id || null,
  source: t.source || "manual",
  is_reviewed: t.is_reviewed ?? true,
  receipt_url: t.receipt_url || null,
  currency: t.currency || "VND",
});

/** BE recurring template → FE recurring template */
const normalizeRecurringTemplate = (r) => ({
  id: r.id,
  walletId: r.wallet_id,
  categoryId: r.category_id || null,
  type: r.type,
  amount: Number(r.amount ?? 0),
  note: r.note || "",
  frequency: r.frequency,
  startDate: r.start_date,
  nextDueDate: r.next_due_date,
  executionTime: r.execution_time || "08:00:00",
  endDate: r.end_date || null,
  notificationEnabled: r.notification_enabled ?? true,
  remindBeforeMinutes: Number(r.remind_before_minutes ?? 30),
  isActive: r.is_active ?? true,
});

/** BE notification → FE notification */
const normalizeNotification = (n) => ({
  id: n.id,
  userId: n.user_id,
  recurringId: n.recurring_id || null,
  title: n.title,
  message: n.message,
  notificationType: n.notification_type,
  scheduledFor: n.scheduled_for,
  isRead: n.is_read ?? false,
  isPaid: n.is_paid ?? false,
  readAt: n.read_at || null,
  createdAt: n.created_at,
});

// ─────────────────────────────────────────────
// WALLETS
// ─────────────────────────────────────────────

export const fetchWallets = async () => {
  const res = await httpClient.get("/api/wallets");
  return (res.data || []).map(normalizeWallet);
};

export const createWallet = async (payload) => {
  const res = await httpClient.post("/api/wallets", {
    name: payload.name,
    currency: payload.currency || "VND",
    color: payload.color || "#2563eb",
    icon: payload.icon || "wallet",
    initial_balance: Number(payload.balance ?? 0),
  });
  return normalizeWallet(res.data);
};

export const updateWallet = async (id, payload) => {
  const res = await httpClient.put(`/api/wallets/${id}`, {
    name: payload.name,
    color: payload.color,
    icon: payload.icon,
    is_active: payload.is_active,
  });
  return normalizeWallet(res.data);
};

export const deleteWallet = async (id) => {
  await httpClient.delete(`/api/wallets/${id}`);
};

// ─────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────

/** Chỉ lấy các category gốc (không có parent_id); BE trả về kèm children[] */
export const fetchCategories = async () => {
  const res = await httpClient.get("/api/categories");
  return (res.data || [])
    .filter((c) => !c.parent_id)
    .map(normalizeCategory);
};

export const createCategory = async (payload) => {
  const res = await httpClient.post("/api/categories", {
    name: payload.name,
    type: payload.type,
    parent_id: payload.parentId || null,
    color: payload.color || "#94a3b8",
    icon: payload.icon || "default",
  });
  return res.data;
};

export const updateCategory = async (id, payload) => {
  const res = await httpClient.put(`/api/categories/${id}`, {
    name: payload.name,
    color: payload.color,
    icon: payload.icon,
    is_active: payload.is_active,
  });
  return res.data;
};

export const deleteCategory = async (id) => {
  await httpClient.delete(`/api/categories/${id}`);
};

// ─────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────

/**
 * Lấy toàn bộ giao dịch (page_size lớn để tải 1 lần).
 * @param {object} params - filter tùy chọn: wallet_id, category_id, type, date_from, date_to
 */
export const fetchTransactions = async (params = {}) => {
  const res = await httpClient.get("/api/transactions", {
    params: { page: 1, page_size: 500, ...params },
  });
  const data = res.data || {};
  // BE trả về TransactionListResponse: { items, total, page, page_size, total_pages }
  const items = Array.isArray(data) ? data : (data.items || []);
  return items.map(normalizeTransaction);
};

export const updateTransaction = async (id, payload) => {
  const res = await httpClient.put(`/api/transactions/${id}`, {
    category_id: payload.categoryId || payload.category_id,
    type: payload.type,
    amount: Number(payload.amount),
    note: payload.name || payload.note || "",
    transacted_at: payload.transacted_at || payload.date,
    receipt_url: payload.receipt_url || null,
    is_reviewed: payload.is_reviewed ?? true,
  });
  return normalizeTransaction(res.data);
};

export const deleteTransaction = async (id) => {
  await httpClient.delete(`/api/transactions/${id}`);
};

// ─────────────────────────────────────────────
// RECURRING TEMPLATES
// ─────────────────────────────────────────────

export const fetchRecurringTemplates = async () => {
  const res = await httpClient.get("/api/recurring");
  return (res.data || []).map(normalizeRecurringTemplate);
};

export const updateRecurringTemplate = async (id, payload) => {
  const res = await httpClient.put(`/api/recurring/${id}`, {
    category_id: payload.categoryId || payload.category_id || null,
    amount: Number(payload.amount),
    note: payload.note || "",
    frequency: payload.frequency,
    next_due_date: payload.next_due_date,
    end_date: payload.end_date || null,
    is_active: payload.is_active,
  });
  return normalizeRecurringTemplate(res.data);
};

export const deleteRecurringTemplate = async (id) => {
  await httpClient.delete(`/api/recurring/${id}`);
};

export const payRecurringNow = async (id) => {
  const res = await httpClient.post(`/api/recurring/${id}/pay-now`);
  return normalizeRecurringTemplate(res.data);
};

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────

export const fetchNotifications = async (params = {}) => {
  const res = await httpClient.get("/api/notifications", {
    params: { page: 1, page_size: 20, ...params },
  });
  const data = res.data || {};
  return {
    items: (data.items || []).map(normalizeNotification),
    total: Number(data.total ?? 0),
    page: Number(data.page ?? 1),
    pageSize: Number(data.page_size ?? 20),
    totalPages: Number(data.total_pages ?? 1),
  };
};

export const fetchUnreadNotificationCount = async () => {
  const res = await httpClient.get("/api/notifications/unread-count");
  return Number(res.data?.unread_count ?? 0);
};

export const markNotificationAsRead = async (id) => {
  const res = await httpClient.patch(`/api/notifications/${id}/read`);
  return normalizeNotification(res.data);
};

export const markNotificationAsUnread = async (id) => {
  const res = await httpClient.patch(`/api/notifications/${id}/unread`);
  return normalizeNotification(res.data);
};

export const markAllNotificationsAsRead = async () => {
  const res = await httpClient.patch("/api/notifications/read-all");
  return Number(res.data?.unread_count ?? 0);
};

export const runNotificationAction = async (id, action) => {
  const res = await httpClient.post(`/api/notifications/${id}/action`, { action });
  return res.data;
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Gửi tin nhắn tới Jelly AI (qua n8n proxy trên BE).
 * @param {{ message: string, sessionId?: string, imageFile?: File }} params
 */
export const jellyChat = async ({ message, sessionId, imageFile }) => {
  let image_base64 = null;
  let image_name = null;
  let image_mime_type = null;

  if (imageFile) {
    image_base64 = await fileToBase64(imageFile);
    image_name = imageFile.name;
    image_mime_type = imageFile.type || "image/jpeg";
  }

  const res = await httpClient.post(
    "/api/ai/jelly-chat",
    { message, session_id: sessionId || null, image_base64, image_name, image_mime_type },
    { timeout: 90000 },
  );
  return res.data; // { session_id, reply }
};

/**
 * Phân tích câu mô tả giao dịch tự nhiên để lấy dữ liệu prefill.
 * @param {string} text
 */
export const parseTransactionText = async (text) => {
  const res = await httpClient.post("/api/ai/parse-transaction", { text });
  const data = res.data || {};
  return {
    ...data,
    amount: data.amount != null ? Number(data.amount) : null,
  };
};

/**
 * OCR hóa đơn — gửi file ảnh, nhận thông tin parse.
 * @param {File} file
 */
export const ocrReceipt = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await httpClient.post("/api/ai/ocr-receipt", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });
  return res.data; // OCRReceiptResponse
};

/** Lấy phân tích xu hướng thu chi 3 tháng gần nhất */
export const fetchAiInsights = async () => {
  const res = await httpClient.get("/api/ai/insights", { timeout: 30000 });
  return res.data; // { analysis, suggestions, period }
};

/** Lấy danh sách chi tiêu bất thường (Z-score) */
export const fetchAiAnomalies = async () => {
  const res = await httpClient.get("/api/ai/anomalies", { timeout: 30000 });
  return res.data; // { anomalies: [...], total_found }
};
