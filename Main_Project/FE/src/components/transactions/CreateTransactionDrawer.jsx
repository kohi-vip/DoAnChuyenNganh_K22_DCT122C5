import { X } from "lucide-react";
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

const toDateValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const emptyToast = { type: "", message: "" };

function CreateTransactionDrawer({ open, onClose, initialPrefill }) {
  const { wallets, setWallets, categories, setTransactions } = useAppData();
  const modalRef = useRef(null);
  const amountInputRef = useRef(null);

  const [entryMode, setEntryMode] = useState("transaction");
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [recurringId, setRecurringId] = useState("");
  const [dateTime, setDateTime] = useState(toDateTimeLocalValue());
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(toDateValue());
  const [executionTime, setExecutionTime] = useState("08:00");
  const [nextDueDate, setNextDueDate] = useState(toDateValue());
  const [endDate, setEndDate] = useState("");
  const [noEndDateLimit, setNoEndDateLimit] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState(30);
  const [note, setNote] = useState("");
  const [attachment, setAttachment] = useState(null);

  const [categorySearch, setCategorySearch] = useState("");
  const [toast, setToast] = useState(emptyToast);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.setTimeout(() => {
      amountInputRef.current?.focus();
    }, 10);

    setWalletId((current) => current || wallets[0]?.id || "");
    setDateTime((current) => current || toDateTimeLocalValue());
    setNextDueDate((current) => current || toDateValue());
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

  const findCategoryIdByName = (categoryName) => {
    if (!categoryName) {
      return "";
    }

    const normalized = categoryName.trim().toLowerCase();
    for (const parent of categories) {
      if ((parent.name || "").trim().toLowerCase() === normalized) {
        return parent.id;
      }

      const child = (parent.children || []).find((item) => (item.name || "").trim().toLowerCase() === normalized);
      if (child) {
        return child.id;
      }
    }

    return "";
  };

  useEffect(() => {
    if (!open || !initialPrefill) {
      return;
    }

    setEntryMode("transaction");

    if (initialPrefill.recurring_id) {
      setRecurringId(initialPrefill.recurring_id);
    }

    if (initialPrefill.amount) {
      setAmount(String(initialPrefill.amount));
    }
    if (initialPrefill.type === "income" || initialPrefill.type === "expense") {
      setType(initialPrefill.type);
    }
    if (initialPrefill.wallet_id) {
      setWalletId(initialPrefill.wallet_id);
    }

    const prefillDate = initialPrefill.transacted_at || initialPrefill.date;
    if (prefillDate) {
      setDateTime(toDateTimeLocalValue(new Date(prefillDate)));
    }

    const prefillNote = initialPrefill.note || (initialPrefill.vendor ? `Hóa đơn ${initialPrefill.vendor}` : "");
    if (prefillNote) {
      setNote(prefillNote);
      setName(prefillNote);
    }

    if (initialPrefill.category_id) {
      setCategoryId(initialPrefill.category_id);
    } else {
      const matchedCategoryId = findCategoryIdByName(initialPrefill.suggested_category || initialPrefill.category);
      if (matchedCategoryId) {
        setCategoryId(matchedCategoryId);
      }
    }
  }, [open, initialPrefill, categories]);

  useEffect(() => {
    if (!open || initialPrefill) {
      return;
    }
    setRecurringId("");
  }, [open, initialPrefill]);

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

  useEffect(() => {
    const firstParent = categoryTree[0];
    const firstChild = firstParent?.children?.[0];
    if (!categoryId || !categoryTree.some((parent) => parent.id === categoryId || parent.children.some((child) => child.id === categoryId))) {
      setCategoryId(firstChild?.id || firstParent?.id || "");
    }
  }, [categoryTree, categoryId]);

  const selectedCategoryLabel = useMemo(() => {
    for (const parent of categories) {
      if (parent.id === categoryId) {
        return parent.name;
      }

      const child = (parent.children || []).find((item) => item.id === categoryId);
      if (child) {
        return `${parent.name} / ${child.name}`;
      }
    }

    return "Chọn danh mục";
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
    setNote("");
    setRecurringId("");
    setAttachment(null);
    setCategorySearch("");
    setDateTime(toDateTimeLocalValue());
    setNextDueDate(toDateValue());
    setEndDate("");
    setNoEndDateLimit(true);
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

  const normalizeDateTime = (value) => {
    if (!value) return value;
    if (value.length === 16) return `${value}:00`;
    return value.slice(0, 19);
  };

  const buildTransactionPayload = () => ({
    name: name.trim(),
    amount: Number(amount),
    type,
    wallet_id: walletId,
    category_id: categoryId,
    recurring_id: recurringId || null,
    transacted_at: normalizeDateTime(dateTime),
    note,
    receipt_url: attachment ? `uploaded://${attachment.name}` : null,
  });

  const buildRecurringPayload = () => ({
    wallet_id: walletId,
    category_id: categoryId,
    type,
    amount: Number(amount),
    note: (note || name || "").trim() || null,
    frequency,
    start_date: startDate,
    execution_time: executionTime,
    next_due_date: nextDueDate,
    end_date: noEndDateLimit ? null : endDate || null,
    notification_enabled: notificationEnabled,
    remind_before_minutes: Number(remindBeforeMinutes),
  });

  const normalizeTransaction = (apiData, payload) => {
    const body = apiData?.transaction || apiData || {};
    const transactedAt = body.transacted_at || payload.transacted_at;

    return {
      id: body.id || `tx_${Date.now()}`,
      name: body.name || payload.name || "Giao dịch mới",
      description: body.note || payload.note || "",
      date: transactedAt,
      transacted_at: transactedAt,
      amount: body.amount || payload.amount,
      type: body.type || payload.type,
      walletId: body.wallet_id || payload.wallet_id,
      categoryId: body.category_id || payload.category_id,
      source: body.source || "manual",
      is_reviewed: body.is_reviewed ?? true,
      receipt_url: body.receipt_url || payload.receipt_url,
    };
  };

  const saveEntry = async (keepOpen) => {
    const isTransactionMode = entryMode === "transaction";

    if (isTransactionMode && (!name.trim() || !amount || Number(amount) <= 0 || !walletId || !categoryId || !dateTime)) {
      setToast({ type: "error", message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
      return;
    }

    if (!isTransactionMode && (!amount || Number(amount) <= 0 || !walletId || !categoryId || !frequency || !nextDueDate)) {
      setToast({ type: "error", message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
      return;
    }

    if (!isTransactionMode && startDate && nextDueDate && nextDueDate < startDate) {
      setToast({
        type: "error",
        message: "Ngày bắt đầu kỳ đầu phải lớn hơn hoặc bằng ngày bắt đầu.",
      });
      return;
    }

    const payload = isTransactionMode ? buildTransactionPayload() : buildRecurringPayload();
    const endpoint = isTransactionMode ? "/api/transactions" : "/api/recurring";

    try {
      setSubmitting(true);
      const response = await httpClient.post(endpoint, payload);

      if (isTransactionMode) {
        const transaction = normalizeTransaction(response.data, payload);
        applyTransactionToLocalStore(transaction);
        if (typeof initialPrefill?.onSuccess === "function") {
          initialPrefill.onSuccess(transaction);
        }
        setToast({ type: "success", message: "Đã tạo giao dịch thành công." });
      } else {
        setToast({ type: "success", message: "Đã tạo giao dịch định kỳ thành công." });
      }
    } catch (error) {
      if (isTransactionMode && error?.response?.status === 404) {
        const localTransaction = normalizeTransaction({}, payload);
        applyTransactionToLocalStore(localTransaction);
        if (typeof initialPrefill?.onSuccess === "function") {
          initialPrefill.onSuccess(localTransaction);
        }
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

          <div className="px-5 pt-3">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setEntryMode("transaction")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  entryMode === "transaction" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
                }`}
              >
                Giao dịch thường
              </button>
              <button
                type="button"
                onClick={() => setEntryMode("recurring")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  entryMode === "recurring" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
                }`}
              >
                Giao dịch định kỳ
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">

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
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  {entryMode === "transaction" ? "Tên giao dịch (Required)" : "Tên lịch giao dịch (Optional)"}
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={entryMode === "transaction" ? "Ví dụ: Ăn trưa, Thanh toán điện..." : "Ví dụ: Tiền nhà, Thu nhập lương..."}
                  required={entryMode === "transaction"}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                />
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

                  {entryMode === "transaction" ? (
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Ngày</span>
                      <input
                        type="datetime-local"
                        value={dateTime}
                        onChange={(event) => setDateTime(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Ngày bắt đầu</span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(event) => {
                            const newStartDate = event.target.value;
                            setStartDate(newStartDate);
                            if (!nextDueDate || nextDueDate < newStartDate) {
                              setNextDueDate(newStartDate);
                            }
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Tần suất</span>
                        <select
                          value={frequency}
                          onChange={(event) => setFrequency(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                        >
                          <option value="daily">Hằng ngày</option>
                          <option value="weekly">Hằng tuần</option>
                          <option value="monthly">Hằng tháng</option>
                          <option value="yearly">Hằng năm</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Giờ thực hiện</span>
                        <input
                          type="time"
                          value={executionTime}
                          onChange={(event) => setExecutionTime(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Ngày bắt đầu kỳ đầu</span>
                        <input
                          type="date"
                          value={nextDueDate}
                          onChange={(event) => setNextDueDate(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Ngày kết thúc (Optional)</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(event) => {
                            setEndDate(event.target.value);
                            setNoEndDateLimit(false);
                          }}
                          disabled={noEndDateLimit}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </label>

                      <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={noEndDateLimit}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setNoEndDateLimit(checked);
                            if (checked) {
                              setEndDate("");
                            }
                          }}
                        />
                        Không giới hạn thời gian giao dịch định kỳ
                      </label>
                    </>
                  )}
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

                  {entryMode === "recurring" && (
                    <>
                      <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={notificationEnabled}
                          onChange={(event) => setNotificationEnabled(event.target.checked)}
                        />
                        Bật thông báo nhắc
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Nhắc trước (phút)</span>
                        <input
                          type="number"
                          min="0"
                          value={remindBeforeMinutes}
                          onChange={(event) => setRemindBeforeMinutes(Number(event.target.value))}
                          disabled={!notificationEnabled}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </label>
                    </>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Ghi chú chi tiết (Optional)</span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                    />
                  </label>
                </div>
              </div>

              {entryMode === "transaction" ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Đính kèm hóa đơn</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none"
                  />
                </label>
              ) : (
                <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Giao dịch định kỳ sẽ tự động tạo giao dịch thật vào ngày đến hạn theo tần suất đã chọn.
                </p>
              )}
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
              onClick={() => saveEntry(true)}
              disabled={submitting}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed"
            >
              {entryMode === "transaction" ? "Lưu và thêm tiếp" : "Lưu và tạo thêm"}
            </button>
            <button
              type="button"
              onClick={() => saveEntry(false)}
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
