import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import httpClient from "../../api/httpClient";
import { useAppData } from "../../stores/AppDataContext";

const toDateTimeLocalValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

export default function QuickPayDrawer({ open, onClose, initialPrefill = null }) {
  if (!open) return null;

  const { wallets, setWallets, categories, transactions, setTransactions, refreshAll } = useAppData();
  const modalRef = useRef(null);
  const amountInputRef = useRef(null);

  const initialType = initialPrefill
    ? initialPrefill.type === "income" || initialPrefill.type === "expense"
      ? initialPrefill.type
      : "expense"
    : "expense";

  let amount = initialPrefill ? String(initialPrefill.amount || "") : "";
  let name = initialPrefill
    ? initialPrefill.note || ""
    : "";
  let walletId = initialPrefill?.wallet_id ?? initialPrefill?.walletId ?? "";
  let categoryId = initialPrefill?.category_id ?? initialPrefill?.categoryId ?? "";
  let dateTime = initialPrefill
    ? (() => {
        const d = initialPrefill.transacted_at || initialPrefill.date;
        return d ? toDateTimeLocalValue(new Date(d)) : toDateTimeLocalValue();
      })()
    : toDateTimeLocalValue();

  const [sAmount, setSAmount] = useState(amount);
  const [sName, setSName] = useState(name);
  const [sNameTouched, setSNameTouched] = useState(Boolean(name));
  const [sWalletId, setSWalletId] = useState(walletId);
  const [sCategoryId, setSCategoryId] = useState(categoryId);
  const [sType, setSType] = useState(initialType);
  const [sDateTime, setSDateTime] = useState(dateTime);
  const [categorySearch, setCategorySearch] = useState("");
  const [toast, setToast] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => amountInputRef.current?.focus(), 10);

    if (!sWalletId && wallets.length > 0) {
      setSWalletId(wallets[0].id);
    }
    if (!sDateTime) {
      setSDateTime(toDateTimeLocalValue());
    }
  }, [open]);

  useEffect(() => {
    if (!toast.message) return;
    const timer = window.setTimeout(() => setToast({ type: "", message: "" }), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") { onClose(); return; }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const applyTransactionToLocalStore = (transaction) => {
    setTransactions((current) => [transaction, ...current]);
    const impact = transaction.type === "income" ? transaction.amount : -transaction.amount;
    setWallets((current) =>
      current.map((wallet) =>
        wallet.id === transaction.walletId
          ? { ...wallet, balance: wallet.balance + impact }
          : wallet
      )
    );
  };

  const normalizeTransaction = (apiData, payload) => {
    const body = apiData?.transaction || apiData || {};
    return {
      id: body.id || `tx_${Date.now()}`,
      name: payload.note || "Giao dịch mới",
      description: payload.note,
      date: payload.transacted_at,
      transacted_at: payload.transacted_at,
      amount: body.amount || payload.amount,
      type: body.type || payload.type,
      walletId: body.wallet_id || payload.wallet_id,
      categoryId: body.category_id || payload.category_id,
    };
  };

  const handleSave = async () => {
    const effectiveAmount = sAmount || amount;
    const effectiveName = sName || name;
    const effectiveWalletId = sWalletId || walletId;
    const effectiveCategoryId = sCategoryId || categoryId;
    const effectiveDateTime = sDateTime || dateTime;

    if (!effectiveAmount || Number(effectiveAmount) <= 0) {
      setToast({ type: "error", message: "Vui lòng nhập số tiền." });
      return;
    }
    if (!effectiveWalletId) {
      setToast({ type: "error", message: "Vui lòng chọn ví." });
      return;
    }
    if (!effectiveDateTime) {
      setToast({ type: "error", message: "Vui lòng chọn ngày." });
      return;
    }
    if (!sNameTouched && !name) {
      setToast({ type: "error", message: "Vui lòng nhập nội dung giao dịch." });
      return;
    }

    const payload = {
      note: effectiveName.trim() || null,
      amount: Number(effectiveAmount),
      type: sType,
      wallet_id: effectiveWalletId,
      category_id: effectiveCategoryId || null,
      transacted_at: effectiveDateTime.length === 16
        ? `${effectiveDateTime}:00`
        : effectiveDateTime.slice(0, 19),
    };

    try {
      setSubmitting(true);
      const response = await httpClient.post("/api/transactions", payload);
      const transaction = normalizeTransaction(response.data, payload);
      applyTransactionToLocalStore(transaction);

      if (typeof initialPrefill?.onSuccess === "function") {
        initialPrefill.onSuccess(transaction);
      }

      setToast({ type: "success", message: "Đã thanh toán thành công." });
      await refreshAll();
      setTimeout(() => onClose(), 800);
    } catch (error) {
      if (error?.response?.status === 404) {
        const localTransaction = normalizeTransaction({}, payload);
        applyTransactionToLocalStore(localTransaction);
        if (typeof initialPrefill?.onSuccess === "function") {
          initialPrefill.onSuccess(localTransaction);
        }
        setToast({ type: "success", message: "Đã thanh toán (local mode)." });
        await refreshAll();
        setTimeout(() => onClose(), 800);
      } else {
        setToast({ type: "error", message: error?.response?.data?.detail || "Không thể thanh toán." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categoryTree = categories;
  const filteredCategories = categorySearch.trim()
    ? categoryTree
        .map((parent) => ({
            ...parent,
            children: (parent.children || []).filter(
              (c) => c.name.toLowerCase().includes(categorySearch.toLowerCase())
            ),
          }))
        .filter(
          (parent) =>
            parent.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
            (parent.children || []).length > 0
        )
    : categoryTree;

  const selectedCategoryLabel = (() => {
    for (const parent of categoryTree) {
      if (parent.id === (sCategoryId || categoryId)) return parent.name;
      const child = (parent.children || []).find(
        (c) => c.id === (sCategoryId || categoryId)
      );
      if (child) return `${parent.name} > ${child.name}`;
    }
    return "Chưa chọn";
  })();

  const effectiveAmount = sAmount || amount;
  const formattedAmount = effectiveAmount
    ? new Intl.NumberFormat("vi-VN").format(Number(effectiveAmount))
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="h-[85vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Thanh toán</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {/* Số tiền */}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Số tiền</span>
              <input
                ref={amountInputRef}
                type="number"
                min="1"
                value={sAmount || amount}
                onChange={(e) => setSAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-2xl font-semibold text-slate-900 outline-none transition focus:border-blue-500"
              />
              {formattedAmount && (
                <p className="mt-1 text-xs text-slate-500">{formattedAmount} VND</p>
              )}
            </label>

            {/* Loại thu / chi */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setSType("expense")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  sType === "expense" ? "bg-white text-rose-600 shadow-sm" : "text-slate-600"
                }`}
              >
                Chi tiêu
              </button>
              <button
                type="button"
                onClick={() => setSType("income")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  sType === "income" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600"
                }`}
              >
                Thu nhập
              </button>
            </div>

            {/* Nội dung */}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Nội dung giao dịch</span>
              <input
                type="text"
                value={sName || name}
                onChange={(e) => {
                  setSName(e.target.value);
                  setSNameTouched(true);
                }}
                placeholder="Nhập nội dung..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
              />
            </label>

            {/* Ví */}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Ví</span>
              <select
                value={sWalletId || walletId}
                onChange={(e) => setSWalletId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
              >
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name} ({new Intl.NumberFormat("vi-VN").format(wallet.balance)} VND)
                  </option>
                ))}
              </select>
            </label>

            {/* Ngày */}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Ngày</span>
              <input
                type="datetime-local"
                value={sDateTime || dateTime}
                onChange={(e) => setSDateTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
              />
            </label>

            {/* Danh mục */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Danh mục</label>
              <input
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Tìm danh mục..."
                className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
              />
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                {filteredCategories.map((parent) => (
                  <div key={parent.id} className="mb-1 last:mb-0">
                    <button
                      type="button"
                      onClick={() => setSCategoryId(parent.id === (sCategoryId || categoryId) ? "" : parent.id)}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                        parent.id === (sCategoryId || categoryId)
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {parent.name}
                    </button>
                    {(parent.children || []).map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => setSCategoryId(child.id)}
                        className={`mt-1 w-full rounded-lg px-2 py-1.5 pl-6 text-left text-sm ${
                          child.id === (sCategoryId || categoryId)
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">Đã chọn: {selectedCategoryLabel}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submitting ? "Đang lưu..." : "Thanh toán"}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast.message && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[60]">
          <div
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg ${
              toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
