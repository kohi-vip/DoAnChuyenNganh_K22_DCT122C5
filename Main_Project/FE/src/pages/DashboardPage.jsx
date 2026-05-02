import { useMemo, useRef, useState } from "react";
import { deleteTransaction, fetchWallets, updateTransaction } from "../api/financeApi";
import ExpensePolarChart from "../components/dashboard/ExpensePolarChart";
import MonthlyBarChart from "../components/dashboard/MonthlyBarChart";
import OverviewCards from "../components/dashboard/OverviewCards";
import RecentTransactionsTable from "../components/dashboard/RecentTransactionsTable";
import NotificationDialog from "../components/common/NotificationDialog";
import DeleteTransactionDialog from "../components/transactions/DeleteTransactionDialog";
import TransactionEditModal from "../components/transactions/TransactionEditModal";
import { useAppData } from "../stores/AppDataContext";
// import seedData from "../utils/seedData"; // không dùng seed data nữa

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// const transactionImpact = ... // không cần nữa, số dư ví được tải lại từ API sau mỗi mutation

function DashboardPage() {
  const { wallets, setWallets, categories, transactions, setTransactions } = useAppData();
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

  const categoryParentLookup = useMemo(() => {
    const lookup = new Map();

    categories.forEach((parent) => {
      lookup.set(parent.id, {
        parentId: parent.id,
        parentName: parent.name,
        parentColor: parent.color || "#94a3b8",
      });
      parent.children.forEach((child) => {
        lookup.set(child.id, {
          parentId: parent.id,
          parentName: parent.name,
          parentColor: parent.color || "#94a3b8",
        });
      });
    });

    return lookup;
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

  const summary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);

    const monthTransactions = transactions.filter((item) => {
      const date = new Date(item.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const monthIncome = monthTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0);

    const monthExpense = monthTransactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);

    return { totalBalance, monthIncome, monthExpense };
  }, [wallets, transactions]);

  const expenseDistributionData = useMemo(() => {
    const parentTotals = new Map();

    transactions.forEach((item) => {
      if (item.type !== "expense") {
        return;
      }

      const parentMeta =
        categoryParentLookup.get(item.categoryId) || {
          parentId: "unknown",
          parentName: "Khác",
          parentColor: "#94a3b8",
        };

      const current =
        parentTotals.get(parentMeta.parentId) || {
          id: parentMeta.parentId,
          name: parentMeta.parentName,
          value: 0,
          color: parentMeta.parentColor,
        };

      parentTotals.set(parentMeta.parentId, {
        ...current,
        value: current.value + item.amount,
      });
    });

    const sorted = [...parentTotals.values()].sort((a, b) => b.value - a.value);

    if (sorted.length === 0) {
      return [
        {
          id: "no_data",
          name: "Chưa có dữ liệu chi",
          value: 0,
          color: "#cbd5e1",
        },
      ];
    }

    return sorted;
  }, [transactions, categoryParentLookup]);

  const walletNameById = useMemo(() => {
    const lookup = new Map();
    wallets.forEach((wallet) => {
      lookup.set(wallet.id, wallet.name);
    });
    return lookup;
  }, [wallets]);

  const categoryMetaById = useMemo(() => {
    const lookup = new Map();
    categoryOptions.forEach((category) => {
      lookup.set(category.id, {
        category_name: category.name,
        category_color: category.color,
      });
    });
    return lookup;
  }, [categoryOptions]);

  const recentRows = useMemo(() => {
    const sourceTransactions = transactions;

    return [...sourceTransactions]
      .filter((item) => item.type === "income" || item.type === "expense" || item.type === "transfer")
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6)
      .map((item) => {
        const categoryMeta = categoryMetaById.get(item.categoryId) || {
          category_name: "Chưa phân loại",
          category_color: "#64748b",
        };

        return {
          id: item.id,
          name: item.name || "Chuyển khoản nội bộ",
          note: item.description || item.note || "",
          transacted_at: item.date,
          amount: item.amount,
          type: item.type,
          transferDirection: item.transferDirection,
          wallet_name: walletNameById.get(item.walletId) || "Không xác định",
          category_name: categoryMeta.category_name,
          category_color: categoryMeta.category_color,
          rawTransaction: item,
        };
      });
  }, [transactions, categoryMetaById, walletNameById]);

  const handleToggleRow = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleToggleAllRows = () => {
    const rowIds = recentRows.map((row) => row.id);
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
        // Gọi API cập nhật giao dịch
        const saved = await updateTransaction(updatedTransaction.id, updatedTransaction);
        setTransactions((current) =>
          current.map((item) => (item.id === saved.id ? saved : item))
        );
        // Tải lại số dư ví từ API (BE tự điều chỉnh balance)
        const updatedWallets = await fetchWallets();
        setWallets(updatedWallets);
      } catch (err) {
        setFeedback({ type: "error", message: err?.response?.data?.detail || "Không thể cập nhật giao dịch." });
        return;
      }
    });

    setEditingTransaction(null);
    setFeedback({ type: "success", message: "Đã cập nhật giao dịch và đồng bộ số dư ví." });
  };

  const handleDeleteConfirmed = async () => {
    if (!deletingTransaction) {
      return;
    }

    await runWithWalletLocks([deletingTransaction.walletId], async () => {
      try {
        await deleteTransaction(deletingTransaction.id);
        setTransactions((current) => current.filter((item) => item.id !== deletingTransaction.id));
        // Tải lại số dư ví từ API
        const updatedWallets = await fetchWallets();
        setWallets(updatedWallets);
      } catch (err) {
        setFeedback({ type: "error", message: err?.response?.data?.detail || "Không thể xóa giao dịch." });
      }
    });

    setSelectedIds((current) => current.filter((id) => id !== deletingTransaction.id));
    setDeletingTransaction(null);
    setFeedback({ type: "success", message: "Đã xóa giao dịch và hoàn tác số dư ví." });
  };

  return (
    <div className="space-y-5 text-slate-900" style={{ fontFamily: "Inter, sans-serif" }}>
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Trang chủ</h1>
      </header>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Tổng quan</h2>
          <button type="button" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Xem chi tiết
          </button>
        </div>

        <OverviewCards
          totalBalance={summary.totalBalance}
          monthIncome={summary.monthIncome}
          monthExpense={summary.monthExpense}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MonthlyBarChart transactions={transactions} />
        <ExpensePolarChart data={expenseDistributionData} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Giao dịch gần đây</h2>
          <button type="button" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Xem chi tiết
          </button>
        </div>

        <RecentTransactionsTable
          rows={recentRows}
          selectedIds={selectedIds}
          onToggleAllRows={handleToggleAllRows}
          onToggleRow={handleToggleRow}
          onEdit={setEditingTransaction}
          onDelete={setDeletingTransaction}
        />
      </section>

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

export default DashboardPage;
