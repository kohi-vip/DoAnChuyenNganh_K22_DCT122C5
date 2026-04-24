import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

const emptyToast = { type: "", message: "" };

function CreateTransactionDrawer({ open, onClose }) {
  const { wallets, setWallets, categories, setTransactions, refreshAll } = useAppData();
  const modalRef = useRef(null);
  const amountInputRef = useRef(null);

  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dateTime, setDateTime] = useState(toDateTimeLocalValue());

  const [categorySearch, setCategorySearch] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [toast, setToast] = useState(emptyToast);
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.setTimeout(() => {
      amountInputRef.current?.focus();
    }, 10);

    setWalletId((current) => current || wallets[0]?.id || "");
    setDateTime((current) => current || toDateTimeLocalValue());
  }, [open, wallets]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = modalRef.current?.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );

      if (!focusable || focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!toast.message) {
      return;
    }

    const timer = window.setTimeout(() => setToast(emptyToast), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const categoryTree = useMemo(() => {
    const keyword = categorySearch.trim().toLowerCase();

    return categories
      .filter((parent) => parent.type === type)
      .map((parent) => {
        const children = (parent.children || []).filter((child) => {
          if (!keyword) {
            return true;
          }

          return child.name.toLowerCase().includes(keyword);
        });

        const parentMatched = parent.name.toLowerCase().includes(keyword);
        if (!keyword || parentMatched || children.length > 0) {
          return { ...parent, children };
        }

        return null;
      })
      .filter(Boolean);
  }, [categories, categorySearch, type]);

  const selectedCategoryLabel = useMemo(() => {
    if (!categoryId) {
      return "Chưa chọn";
    }

    for (const parent of categories) {
      if (parent.id === categoryId) {
        return parent.name;
      }

      const child = (parent.children || []).find((item) => item.id === categoryId);
      if (child) {
        return `${parent.name} / ${child.name}`;
      }
    }

    return "Chưa chọn";
  }, [categories, categoryId]);

  const formattedAmount = useMemo(() => {
    const numeric = Number(amount || 0);
    if (!numeric) {
      return "0 VND";
    }

    return `${new Intl.NumberFormat("vi-VN").format(numeric)} VND`;
  }, [amount]);

  const resetForNext = () => {
    setAmount("");
    setName("");
    setAiInput("");
    setCategorySearch("");
    setCategoryId("");
  };

  const applyTransactionToLocalStore = (transaction) => {
    setTransactions((current) => [transaction, ...current]);

    const impact = transaction.type === "income" ? transaction.amount : -transaction.amount;

    setWallets((current) =>
      current.map((wallet) =>
        wallet.id === transaction.walletId
          ? {
              ...wallet,
              balance: wallet.balance + impact,
            }
          : wallet
      )
    );
  };

  const buildPayload = () => ({
    name: name.trim(),
    amount: Number(amount),
    type,
    wallet_id: walletId,
    category_id: categoryId,
    transacted_at: new Date(dateTime).toISOString(),
    source: "manual",
    is_reviewed: true,
  });

  const normalizeTransaction = (apiData, payload) => {
    const body = apiData?.transaction || apiData || {};
    const transactedAt = body.transacted_at || payload.transacted_at;

    return {
      id: body.id || `tx_${Date.now()}`,
      name: body.name || payload.name || "Giao dịch mới",
      description: body.name || payload.name || "",
      date: transactedAt,
      transacted_at: transactedAt,
      amount: body.amount || payload.amount,
      type: body.type || payload.type,
      walletId: body.wallet_id || payload.wallet_id,
      categoryId: body.category_id || payload.category_id,
      source: body.source || "manual",
      is_reviewed: body.is_reviewed ?? true,
    };
  };

  const saveTransaction = async (keepOpen) => {
    if (!name.trim() || !amount || Number(amount) <= 0 || !walletId || !categoryId || !dateTime) {
      setToast({ type: "error", message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
      return;
    }

    const payload = buildPayload();

    try {
      setSubmitting(true);
      const response = await httpClient.post("/api/transactions", payload);
      const transaction = normalizeTransaction(response.data, payload);
      applyTransactionToLocalStore(transaction);
      setToast({ type: "success", message: "Đã tạo giao dịch thành công." });
      await refreshAll();
    } catch (error) {
      if (error?.response?.status === 404) {
        const localTransaction = normalizeTransaction({}, payload);
        applyTransactionToLocalStore(localTransaction);
        setToast({ type: "success", message: "Đã tạo giao dịch (local mode)." });
      } else {
        setToast({ type: "error", message: error?.response?.data?.detail || "Không thể tạo giao dịch." });
        return;
      }
    } finally {
      setSubmitting(false);
    }

    if (keepOpen) {
      resetForNext();
      amountInputRef.current?.focus();
      return;
    }

    onClose();
    resetForNext();
  };

  const handleParseNlp = async () => {
    if (!aiInput.trim()) {
      return;
    }

    try {
      setParsing(true);
      const response = await httpClient.post("/api/ai/parse-transaction", { text: aiInput.trim() });
      const parsed = response.data || {};

      if (parsed.amount) {
        setAmount(String(parsed.amount));
      }
      if (parsed.type === "income" || parsed.type === "expense") {
        setType(parsed.type);
      }
      if (parsed.wallet_id) {
        setWalletId(parsed.wallet_id);
      }
      if (parsed.category_id) {
        setCategoryId(parsed.category_id);
      }
      if (parsed.transacted_at) {
        setDateTime(toDateTimeLocalValue(new Date(parsed.transacted_at)));
      }
      if (parsed.name) {
        setName(parsed.name);
      }

      setToast({ type: "success", message: "Đã phân tích nội dung AI, vui lòng kiểm tra lại trước khi lưu." });
    } catch (error) {
      setToast({ type: "error", message: error?.response?.data?.detail || "Không thể phân tích bằng AI." });
    } finally {
      setParsing(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Thêm giao dịch</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sparkles className="h-4 w-4 text-blue-600" /> AI Shortcut
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={aiInput}
                    onChange={(event) => setAiInput(event.target.value)}
                    placeholder="Nhập bằng giọng nói hoặc văn bản..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleParseNlp}
                    disabled={parsing}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {parsing ? "Đang parse" : "Parse"}
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="mx-auto w-full max-w-xl space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Số tiền</span>
                  <input
                    ref={amountInputRef}
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-2xl font-semibold text-slate-900 outline-none transition focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">{formattedAmount}</p>
                </label>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      type === "expense" ? "bg-white text-rose-600 shadow-sm" : "text-slate-600"
                    }`}
                  >
                    Chi tiêu
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      type === "income" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600"
                    }`}
                  >
                    Thu nhập
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Nội dung giao dịch</span>
                <select
                  value={name}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (val === "Khác") {
                      setName("");
                    } else {
                      setName(val);
                    }
                  }}
                  className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                >
                  <option value="">-- Chọn nội dung --</option>
                  <option value="Ăn uống">Ăn uống</option>
                  <option value="Di chuyển">Di chuyển</option>
                  <option value="Mua sắm">Mua sắm</option>
                  <option value="Giải trí">Giải trí</option>
                  <option value="Y tế">Y tế</option>
                  <option value="Hóa đơn">Hóa đơn</option>
                  <option value="Nạp tiền">Nạp tiền</option>
                  <option value="Lương">Lương</option>
                  <option value="Chuyển khoản">Chuyển khoản</option>
                  <option value="Khác">Khác (nhập tùy ý)</option>
                </select>
                {name && !["Ăn uống","Di chuyển","Mua sắm","Giải trí","Y tế","Hóa đơn","Nạp tiền","Lương","Chuyển khoản"].includes(name) && (
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nhập nội dung tùy ý..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                  />
                )}
              </label>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Ví</span>
                    <select
                      value={walletId}
                      onChange={(event) => setWalletId(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                    >
                      {wallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Ngày</span>
                    <input
                      type="datetime-local"
                      value={dateTime}
                      onChange={(event) => setDateTime(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                    />
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Danh mục</label>
                    <input
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                      placeholder="Tìm danh mục..."
                      className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                    />
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                      {categoryTree.map((parent) => (
                        <div key={parent.id} className="mb-1 last:mb-0">
                          <button
                            type="button"
                            onClick={() => setCategoryId(parent.id)}
                            className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                              categoryId === parent.id ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {parent.name}
                          </button>
                          {(parent.children || []).map((child) => (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => setCategoryId(child.id)}
                              className={`mt-1 w-full rounded-lg px-2 py-1.5 pl-6 text-left text-sm ${
                                categoryId === child.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
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
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => saveTransaction(true)}
              disabled={submitting}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed"
            >
              Lưu và thêm tiếp
            </button>
            <button
              type="button"
              onClick={() => saveTransaction(false)}
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submitting ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      </div>

      {toast.message ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[60]">
          <div
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg ${
              toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CreateTransactionDrawer;
