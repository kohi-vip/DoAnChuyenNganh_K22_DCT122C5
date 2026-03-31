import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getLocalAppData, persistAppData } from "../utils/localDataStore";

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const initialData = getLocalAppData();
  const [wallets, setWallets] = useState(initialData.wallets || []);
  const [categories, setCategories] = useState(initialData.categories || []);
  const [transactions, setTransactions] = useState(initialData.transactions || []);

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
    }),
    [wallets, categories, transactions]
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
