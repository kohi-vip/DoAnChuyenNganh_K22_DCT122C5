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
  source: t.source || "manual",
  is_reviewed: t.is_reviewed ?? true,
  receipt_url: t.receipt_url || null,
  currency: t.currency || "VND",
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
