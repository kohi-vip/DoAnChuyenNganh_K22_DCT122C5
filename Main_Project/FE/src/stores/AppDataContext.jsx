/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchCategories, fetchTransactions, fetchTransfers, fetchWallets } from "../api/financeApi";
import { getLocalAppData, persistAppData } from "../utils/localDataStore";
import { useAuth } from "./useAuth";

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const initialData = getLocalAppData();

  const [wallets, setWallets] = useState(initialData.wallets || []);
  const [categories, setCategories] = useState(initialData.categories || []);
  const [transactions, setTransactions] = useState(initialData.transactions || []);
  const [loading, setLoading] = useState(false);

  // Tránh gọi API nhiều lần khi re-render
  const hasFetchedRef = useRef(false);

  /** Tải toàn bộ dữ liệu từ BE (wallets, categories, transactions) */
  const refreshAll = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const [apiWallets, apiCategories, apiTransactions] = await Promise.all([
        fetchWallets(),
        fetchCategories(),
        fetchTransactions(),
      ]);
      let apiTransfers = [];
      try {
        apiTransfers = await fetchTransfers();
      } catch (transferError) {
        console.warn("[AppDataContext] Không thể tải chuyển khoản, chỉ dùng giao dịch thường:", transferError?.message);
      }

      const transferHistoryRows = apiTransfers.flatMap((transfer) => {
        const amount = Number(transfer.amount ?? 0);
        const note = transfer.note || "Chuyển khoản nội bộ";
        const transferredAt = transfer.transferredAt;

        return [
          {
            id: `transfer_${transfer.id}_out`,
            walletId: transfer.fromWalletId,
            categoryId: "cat_transfer",
            recurringId: null,
            type: "transfer",
            amount,
            name: "Chuyển khoản nội bộ",
            note: `${note} • Chuyển đi`,
            description: `${note} • Chuyển đi`,
            date: transferredAt,
            transacted_at: transferredAt,
            source: "transfer",
            transferDirection: "out",
            is_reviewed: true,
            receipt_url: null,
          },
          {
            id: `transfer_${transfer.id}_in`,
            walletId: transfer.toWalletId,
            categoryId: "cat_transfer",
            recurringId: null,
            type: "transfer",
            amount,
            name: "Chuyển khoản nội bộ",
            note: `${note} • Nhận vào`,
            description: `${note} • Nhận vào`,
            date: transferredAt,
            transacted_at: transferredAt,
            source: "transfer",
            transferDirection: "in",
            is_reviewed: true,
            receipt_url: null,
          },
        ];
      });

      const mergedTransactions = [...apiTransactions, ...transferHistoryRows].sort(
        (left, right) =>
          new Date(right.transacted_at || right.date || 0).getTime() -
          new Date(left.transacted_at || left.date || 0).getTime()
      );

      setWallets(apiWallets);
      setCategories(apiCategories);
      setTransactions(mergedTransactions);
    } catch (err) {
      // Nếu API lỗi thì giữ nguyên dữ liệu localStorage đã load lúc khởi tạo
      console.warn("[AppDataContext] Không thể tải dữ liệu từ API, dùng localStorage:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  /** Chỉ tải dữ liệu 1 lần khi user đã xác thực */
  useEffect(() => {
    if (!isAuthenticated) {
      // Khi đăng xuất thì reset dữ liệu
      if (hasFetchedRef.current) {
        hasFetchedRef.current = false;
        setWallets([]);
        setCategories([]);
        setTransactions([]);
      }
      return;
    }

    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    refreshAll();
  }, [isAuthenticated, refreshAll]);

  /** Đồng bộ xuống localStorage mỗi khi state thay đổi */
  useEffect(() => {
    persistAppData({ wallets, categories, transactions });
  }, [wallets, categories, transactions]);

  const value = useMemo(
    () => ({
      wallets,
      setWallets,
      categories,
      setCategories,
      transactions,
      setTransactions,
      loading,
      refreshAll,
    }),
    [wallets, categories, transactions, loading, refreshAll]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
}
