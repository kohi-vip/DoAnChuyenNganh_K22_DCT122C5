import { useState } from "react";
import { Outlet } from "react-router-dom";
import ManagementSidebar from "../components/management/ManagementSidebar";
import CreateTransactionDrawer from "../components/transactions/CreateTransactionDrawer";

function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50">
      <ManagementSidebar onOpenCreateTransaction={() => setDrawerOpen(true)} />
      <main className="h-screen w-3/4 overflow-y-auto bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-[1200px]">
          <Outlet />
        </div>
      </main>
      <CreateTransactionDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

export default MainLayout;
