import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchCategories, fetchTransactions, fetchWallets } from "../api/financeApi";
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
      setWallets(apiWallets);
      setCategories(apiCategories);
      setTransactions(apiTransactions);
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
