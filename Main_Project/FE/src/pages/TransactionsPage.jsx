import { useMemo, useRef, useState } from "react";
import { deleteTransaction, fetchWallets, updateTransaction } from "../api/financeApi";
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

function TransactionsPage() {
  const { wallets, setWallets, categories, transactions, setTransactions } = useAppData();
  const [draftFilters, setDraftFilters] = useState({
    dateFrom: "",
    dateTo: "",
    walletId: "all",
    categoryId: "all",
    type: "all",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: "",
    dateTo: "",
    walletId: "all",
    categoryId: "all",
    type: "all",
  });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const walletLocksRef = useRef(new Set());

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

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((item) => {
        if (appliedFilters.walletId !== "all" && item.walletId !== appliedFilters.walletId) {
          return false;
        }

        if (appliedFilters.categoryId !== "all" && item.categoryId !== appliedFilters.categoryId) {
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
