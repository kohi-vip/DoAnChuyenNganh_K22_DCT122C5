import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteRecurringTemplate,
  deleteTransaction,
  fetchRecurringTemplates,
  fetchWallets,
  updateRecurringTemplate,
  updateTransaction,
} from "../api/financeApi";
import NotificationDialog from "../components/common/NotificationDialog";
import DeleteTransactionDialog from "../components/transactions/DeleteTransactionDialog";
import TransactionEditModal from "../components/transactions/TransactionEditModal";
import TransactionFilters from "../components/transactions/TransactionFilters";
import TransactionTable from "../components/transactions/TransactionTable";
import { useAppData } from "../stores/AppDataContext";

const PAGE_SIZE = 10;

const transactionImpact = (transaction) => {
  if (transaction.type === "income") {
    return transaction.amount;
  }
  if (transaction.type === "expense") {
    return -transaction.amount;
  }
  return 0;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatDate = (isoDate) => {
  if (!isoDate) {
    return "-";
  }
  return new Date(isoDate).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

function TransactionsPage() {
  const { wallets, setWallets, categories, transactions, setTransactions } = useAppData();
  const [draftFilters, setDraftFilters] = useState({
    dateFrom: "",
    dateTo: "",
    transactionKind: "all",
    walletId: "all",
    categoryId: "all",
    type: "all",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: "",
    dateTo: "",
    transactionKind: "all",
    walletId: "all",
    categoryId: "all",
    type: "all",
  });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const [recurringTemplates, setRecurringTemplates] = useState([]);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringPage, setRecurringPage] = useState(1);
  const [recurringDraftFilters, setRecurringDraftFilters] = useState({
    walletId: "all",
    categoryId: "all",
    type: "all",
    frequency: "all",
    status: "all",
  });
  const [recurringAppliedFilters, setRecurringAppliedFilters] = useState({
    walletId: "all",
    categoryId: "all",
    type: "all",
    frequency: "all",
    status: "all",
  });
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [editingRecurringDraft, setEditingRecurringDraft] = useState(null);

  const walletLocksRef = useRef(new Set());

  useEffect(() => {
    const loadRecurringTemplates = async () => {
      try {
        setRecurringLoading(true);
        const items = await fetchRecurringTemplates();
        setRecurringTemplates(items);
      } catch (err) {
        setFeedback({ type: "error", message: err?.response?.data?.detail || "Không thể tải giao dịch định kỳ." });
      } finally {
        setRecurringLoading(false);
      }
    };

    loadRecurringTemplates();
  }, []);

  const categoryOptions = useMemo(() => {
    const flattened = [];

    categories.forEach((parent) => {
      flattened.push({
        id: parent.id,
        name: parent.name,
        type: parent.type,
        color: parent.color,
      });

      parent.children.forEach((child) => {
        flattened.push({
          id: child.id,
          name: child.name,
          type: parent.type,
          color: child.color || parent.color,
        });
      });
    });

    flattened.push({
      id: "cat_transfer",
      name: "Chuyển khoản nội bộ",
      type: "transfer",
      color: "#475569",
    });

    return flattened;
  }, [categories]);

  const runWithWalletLocks = async (walletIds, mutation) => {
    const uniqueWallets = [...new Set(walletIds.filter(Boolean))].sort();

    for (const walletId of uniqueWallets) {
      while (walletLocksRef.current.has(walletId)) {
        await delay(25);
      }
    }

    uniqueWallets.forEach((walletId) => walletLocksRef.current.add(walletId));

    try {
      await mutation();
    } finally {
      uniqueWallets.forEach((walletId) => walletLocksRef.current.delete(walletId));
    }
  };

  const handleChangeDraft = (key, value) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(1);
  };

  const handleChangeRecurringDraft = (key, value) => {
    setRecurringDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const handleApplyRecurringFilters = () => {
    setRecurringAppliedFilters(recurringDraftFilters);
    setRecurringPage(1);
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((item) => {
        if (appliedFilters.walletId !== "all" && item.walletId !== appliedFilters.walletId) {
          return false;
        }

        if (appliedFilters.categoryId !== "all" && item.categoryId !== appliedFilters.categoryId) {
          return false;
        }

        if (appliedFilters.transactionKind === "regular" && item.recurringId) {
          return false;
        }

        if (appliedFilters.transactionKind === "recurring" && !item.recurringId) {
          return false;
        }

        if (appliedFilters.type !== "all" && item.type !== appliedFilters.type) {
          return false;
        }

        if (appliedFilters.dateFrom) {
          const fromDate = new Date(appliedFilters.dateFrom);
          if (new Date(item.date) < fromDate) {
            return false;
          }
        }

        if (appliedFilters.dateTo) {
          const toDate = new Date(appliedFilters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (new Date(item.date) > toDate) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const bTimestamp = new Date(b.transacted_at || b.date || 0).getTime();
        const aTimestamp = new Date(a.transacted_at || a.date || 0).getTime();
        return bTimestamp - aTimestamp;
      });
  }, [transactions, appliedFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, page]);

  const reportSummary = useMemo(() => {
    const base = filteredTransactions.filter((item) => item.type !== "transfer");
    const income = base
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0);
    const expense = base
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);

    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const filteredRecurringTemplates = useMemo(() => {
    return recurringTemplates
      .filter((item) => {
        if (recurringAppliedFilters.walletId !== "all" && item.walletId !== recurringAppliedFilters.walletId) {
          return false;
        }
        if (recurringAppliedFilters.categoryId !== "all" && item.categoryId !== recurringAppliedFilters.categoryId) {
          return false;
        }
        if (recurringAppliedFilters.type !== "all" && item.type !== recurringAppliedFilters.type) {
          return false;
        }
        if (recurringAppliedFilters.frequency !== "all" && item.frequency !== recurringAppliedFilters.frequency) {
          return false;
        }
        if (recurringAppliedFilters.status === "active" && !item.isActive) {
          return false;
        }
        if (recurringAppliedFilters.status === "inactive" && item.isActive) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  }, [recurringTemplates, recurringAppliedFilters]);

  const recurringTotalPages = Math.max(1, Math.ceil(filteredRecurringTemplates.length / PAGE_SIZE));

  const recurringRows = useMemo(() => {
    const start = (recurringPage - 1) * PAGE_SIZE;
    return filteredRecurringTemplates.slice(start, start + PAGE_SIZE);
  }, [filteredRecurringTemplates, recurringPage]);

  const getWalletName = (walletId) => wallets.find((wallet) => wallet.id === walletId)?.name || "Không xác định";

  const getCategoryMeta = (categoryId) =>
    categoryOptions.find((category) => category.id === categoryId) || {
      id: "unknown",
      name: "Chưa phân loại",
      color: "#64748b",
    };

  const handleToggleRow = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleToggleAllCurrentPage = () => {
    const rowIds = paginatedRows.map((row) => row.id);
    const allChecked = rowIds.every((id) => selectedIds.includes(id));

    if (allChecked) {
      setSelectedIds((current) => current.filter((id) => !rowIds.includes(id)));
      return;
    }

    setSelectedIds((current) => [...new Set([...current, ...rowIds])]);
  };

  const handleSaveEdit = async (updatedTransaction) => {
    const oldTransaction = transactions.find((item) => item.id === updatedTransaction.id);
    if (!oldTransaction) {
      return;
    }

    const impactedWallets = [oldTransaction.walletId, updatedTransaction.walletId];

    await runWithWalletLocks(impactedWallets, async () => {
      try {
        const saved = await updateTransaction(updatedTransaction.id, updatedTransaction);
        setTransactions((current) =>
          current.map((item) => (item.id === saved.id ? saved : item))
        );
        // Tải lại số dư ví từ API
        const updatedWallets = await fetchWallets();
        setWallets(updatedWallets);
      } catch (err) {
        setFeedback({ type: "error", message: err?.response?.data?.detail || "Không thể cập nhật giao dịch." });
        return;
      }
    });

    setEditingTransaction(null);
    setFeedback({ type: "success", message: "Đã cập nhật giao dịch và cân bằng lại số dư ví." });
  };

  const handleDeleteConfirmed = async () => {
    if (!deletingTransaction) {
      return;
    }

    await runWithWalletLocks([deletingTransaction.walletId], async () => {
      try {
        await deleteTransaction(deletingTransaction.id);
        setTransactions((current) =>
          current.filter((item) => item.id !== deletingTransaction.id)
        );
        // Tải lại số dư ví từ API
        const updatedWallets = await fetchWallets();
        setWallets(updatedWallets);
      } catch (err) {
        setFeedback({ type: "error", message: err?.response?.data?.detail || "Không thể xóa giao dịch." });
      }
    });

    setSelectedIds((current) => current.filter((id) => id !== deletingTransaction.id));
    setFeedback({ type: "success", message: "Đã xóa giao dịch và hoàn tác số dư ví." });
    setDeletingTransaction(null);
  };

  const openRecurringEdit = (item) => {
    setEditingRecurring(item);
    setEditingRecurringDraft({
      amount: String(item.amount || ""),
      note: item.note || "",
      frequency: item.frequency,
      next_due_date: item.nextDueDate,
      end_date: item.endDate || "",
      noEndDateLimit: !item.endDate,
      is_active: item.isActive,
      categoryId: item.categoryId || "",
    });
  };

  const handleSaveRecurringEdit = async () => {
    if (!editingRecurring || !editingRecurringDraft) {
      return;
    }

    if (!editingRecurringDraft.amount || Number(editingRecurringDraft.amount) <= 0) {
      setFeedback({ type: "error", message: "Số tiền giao dịch định kỳ phải lớn hơn 0." });
      return;
    }

    if (!editingRecurringDraft.next_due_date) {
      setFeedback({ type: "error", message: "Vui lòng nhập ngày kỳ tới." });
      return;
    }

    try {
      const saved = await updateRecurringTemplate(editingRecurring.id, {
        amount: Number(editingRecurringDraft.amount),
        note: editingRecurringDraft.note,
        frequency: editingRecurringDraft.frequency,
        next_due_date: editingRecurringDraft.next_due_date,
        end_date: editingRecurringDraft.noEndDateLimit ? null : editingRecurringDraft.end_date || null,
        is_active: editingRecurringDraft.is_active,
        category_id: editingRecurringDraft.categoryId || null,
      });

      setRecurringTemplates((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setFeedback({ type: "success", message: "Đã cập nhật kế hoạch giao dịch định kỳ." });
      setEditingRecurring(null);
      setEditingRecurringDraft(null);
    } catch (err) {
      setFeedback({ type: "error", message: err?.response?.data?.detail || "Không thể cập nhật giao dịch định kỳ." });
    }
  };

  const handleDeleteRecurring = async (item) => {
    const ok = window.confirm(`Bạn có chắc muốn xóa kế hoạch định kỳ: ${item.note || item.id}?`);
    if (!ok) {
      return;
    }

    try {
      await deleteRecurringTemplate(item.id);
      setRecurringTemplates((current) => current.filter((rec) => rec.id !== item.id));
      setFeedback({ type: "success", message: "Đã xóa kế hoạch giao dịch định kỳ." });
    } catch (err) {
      setFeedback({ type: "error", message: err?.response?.data?.detail || "Không thể xóa giao dịch định kỳ." });
    }
  };

  return (
    <div className="space-y-4 text-slate-900">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Quản lý giao dịch</h1>
        <p className="mt-1 text-sm text-slate-600">
          Quản lý lịch sử thu chi, giao dịch tự đồng bộ và giao dịch chuyển khoản nội bộ.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tổng thu (không gồm transfer)</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">
            {new Intl.NumberFormat("vi-VN").format(reportSummary.income)} VND
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tổng chi (không gồm transfer)</p>
          <p className="mt-1 text-xl font-bold text-rose-600">
            {new Intl.NumberFormat("vi-VN").format(reportSummary.expense)} VND
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số dư báo cáo</p>
          <p className="mt-1 text-xl font-bold text-blue-700">
            {new Intl.NumberFormat("vi-VN").format(reportSummary.balance)} VND
          </p>
        </div>
      </div>

      <TransactionFilters
        draftFilters={draftFilters}
        onChangeDraft={handleChangeDraft}
        onApplyFilters={handleApplyFilters}
        walletOptions={wallets}
        categoryOptions={categoryOptions}
      />

      <TransactionTable
        rows={paginatedRows}
        page={page}
        totalPages={totalPages}
        selectedIds={selectedIds}
        onToggleAllCurrentPage={handleToggleAllCurrentPage}
        onToggleRow={handleToggleRow}
        onChangePage={setPage}
        getWalletName={getWalletName}
        getCategoryMeta={getCategoryMeta}
        onEdit={setEditingTransaction}
        onDelete={setDeletingTransaction}
      />

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Quản lý giao dịch định kỳ</h2>
          <p className="mt-1 text-sm text-slate-600">
            Bảng này chỉ hiển thị kế hoạch định kỳ (template), không hiển thị giao dịch đã phát sinh.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Lọc theo ví</label>
            <select
              value={recurringDraftFilters.walletId}
              onChange={(event) => handleChangeRecurringDraft("walletId", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
            >
              <option value="all">Tất cả ví</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Lọc danh mục</label>
            <select
              value={recurringDraftFilters.categoryId}
              onChange={(event) => handleChangeRecurringDraft("categoryId", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
            >
              <option value="all">Tất cả danh mục</option>
              {categoryOptions
                .filter((category) => category.id !== "cat_transfer")
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Loại giao dịch</label>
            <select
              value={recurringDraftFilters.type}
              onChange={(event) => handleChangeRecurringDraft("type", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="income">Thu nhập</option>
              <option value="expense">Chi tiêu</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tần suất</label>
            <select
              value={recurringDraftFilters.frequency}
              onChange={(event) => handleChangeRecurringDraft("frequency", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="daily">Hằng ngày</option>
              <option value="weekly">Hằng tuần</option>
              <option value="monthly">Hằng tháng</option>
              <option value="yearly">Hằng năm</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Trạng thái</label>
            <select
              value={recurringDraftFilters.status}
              onChange={(event) => handleChangeRecurringDraft("status", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã tắt</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleApplyRecurringFilters}
              className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Lọc dữ liệu
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1100px] w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Mô tả kế hoạch</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Loại</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Số tiền</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Ví</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Danh mục</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Tần suất</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Kỳ tới</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Kết thúc</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Trạng thái</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {recurringLoading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                    Đang tải giao dịch định kỳ...
                  </td>
                </tr>
              ) : recurringRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                    Chưa có kế hoạch giao dịch định kỳ phù hợp.
                  </td>
                </tr>
              ) : (
                recurringRows.map((item) => {
                  const category = getCategoryMeta(item.categoryId);
                  return (
                    <tr key={item.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-800">{item.note || "Kế hoạch định kỳ"}</td>
                      <td className="px-3 py-2.5 text-slate-700">{item.type === "income" ? "Thu nhập" : "Chi tiêu"}</td>
                      <td className={`px-3 py-2.5 font-semibold ${item.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                        {new Intl.NumberFormat("vi-VN").format(item.amount)} VND
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{getWalletName(item.walletId)}</td>
                      <td className="px-3 py-2.5 text-slate-700">{category.name}</td>
                      <td className="px-3 py-2.5 text-slate-700">{item.frequency}</td>
                      <td className="px-3 py-2.5 text-slate-700">{formatDate(item.nextDueDate)}</td>
                      <td className="px-3 py-2.5 text-slate-700">{item.endDate ? formatDate(item.endDate) : "Không giới hạn"}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.isActive ? "Đang hoạt động" : "Đã tắt"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openRecurringEdit(item)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                            aria-label="Sửa kế hoạch định kỳ"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecurring(item)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                            aria-label="Xóa kế hoạch định kỳ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => setRecurringPage((current) => Math.max(1, current - 1))}
            disabled={recurringPage === 1}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Trước
          </button>

          <div className="flex flex-wrap items-center gap-1">
            {Array.from({ length: recurringTotalPages }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setRecurringPage(number)}
                className={`h-8 min-w-8 rounded-md px-2 text-sm ${
                  number === recurringPage
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {number}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setRecurringPage((current) => Math.min(recurringTotalPages, current + 1))}
            disabled={recurringPage === recurringTotalPages}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sau
          </button>
        </div>
      </section>

      {editingRecurring && editingRecurringDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Chỉnh sửa giao dịch định kỳ</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingRecurring(null);
                  setEditingRecurringDraft(null);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Số tiền</span>
                <input
                  type="number"
                  min="1"
                  value={editingRecurringDraft.amount}
                  onChange={(event) => setEditingRecurringDraft((current) => ({ ...current, amount: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Tần suất</span>
                <select
                  value={editingRecurringDraft.frequency}
                  onChange={(event) => setEditingRecurringDraft((current) => ({ ...current, frequency: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                >
                  <option value="daily">Hằng ngày</option>
                  <option value="weekly">Hằng tuần</option>
                  <option value="monthly">Hằng tháng</option>
                  <option value="yearly">Hằng năm</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Ngày kỳ tới</span>
                <input
                  type="date"
                  value={editingRecurringDraft.next_due_date}
                  onChange={(event) => setEditingRecurringDraft((current) => ({ ...current, next_due_date: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Ngày kết thúc</span>
                <input
                  type="date"
                  value={editingRecurringDraft.end_date}
                  onChange={(event) =>
                    setEditingRecurringDraft((current) => ({
                      ...current,
                      end_date: event.target.value,
                      noEndDateLimit: false,
                    }))
                  }
                  disabled={editingRecurringDraft.noEndDateLimit}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>

              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={editingRecurringDraft.noEndDateLimit}
                  onChange={(event) =>
                    setEditingRecurringDraft((current) => ({
                      ...current,
                      noEndDateLimit: event.target.checked,
                      end_date: event.target.checked ? "" : current.end_date,
                    }))
                  }
                />
                Không giới hạn thời gian giao dịch định kỳ
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-slate-700">Ghi chú kế hoạch</span>
                <textarea
                  rows={2}
                  value={editingRecurringDraft.note}
                  onChange={(event) => setEditingRecurringDraft((current) => ({ ...current, note: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                />
              </label>

              <label className="inline-flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={editingRecurringDraft.is_active}
                  onChange={(event) => setEditingRecurringDraft((current) => ({ ...current, is_active: event.target.checked }))}
                />
                <span className="text-sm text-slate-700">Đang hoạt động</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setEditingRecurring(null);
                  setEditingRecurringDraft(null);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveRecurringEdit}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TransactionEditModal
        open={Boolean(editingTransaction)}
        transaction={editingTransaction}
        walletOptions={wallets}
        categoryOptions={categoryOptions}
        onClose={() => setEditingTransaction(null)}
        onSave={handleSaveEdit}
      />

      <DeleteTransactionDialog
        open={Boolean(deletingTransaction)}
        transactionName={deletingTransaction?.name}
        onCancel={() => setDeletingTransaction(null)}
        onConfirm={handleDeleteConfirmed}
      />

      <NotificationDialog
        open={Boolean(feedback)}
        type={feedback?.type === "error" ? "error" : "success"}
        title={feedback?.type === "error" ? "Thao tác không thành công" : "Thao tác thành công"}
        message={feedback?.message || ""}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}

export default TransactionsPage;
