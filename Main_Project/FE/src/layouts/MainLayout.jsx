import { useState } from "react";
import { Outlet } from "react-router-dom";
import ManagementSidebar from "../components/management/ManagementSidebar";
import CreateTransactionDrawer from "../components/transactions/CreateTransactionDrawer";

function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPrefill, setDrawerPrefill] = useState(null);

  const openCreateTransaction = (prefill = null) => {
    setDrawerPrefill(prefill);
    setDrawerOpen(true);
  };

  const closeCreateTransaction = () => {
    setDrawerOpen(false);
    setDrawerPrefill(null);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <ManagementSidebar onOpenCreateTransaction={() => openCreateTransaction()} />
      <main className="h-screen w-3/4 overflow-y-auto bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-[1200px]">
          <Outlet context={{ openCreateTransaction }} />
        </div>
      </main>
      <CreateTransactionDrawer
        open={drawerOpen}
        onClose={closeCreateTransaction}
        initialPrefill={drawerPrefill}
      />
    </div>
  );
}

export default MainLayout;
