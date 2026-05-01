import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import ManagementSidebar from "../components/management/ManagementSidebar";
import CreateTransactionDrawer from "../components/transactions/CreateTransactionDrawer";

function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPrefill, setDrawerPrefill] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const openCreateTransaction = (prefill = null) => {
    setDrawerPrefill(prefill);
    setDrawerOpen(true);
  };

  const closeCreateTransaction = () => {
    setDrawerOpen(false);
    setDrawerPrefill(null);
  };

  useEffect(() => {
    if (!feedback?.message) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const shouldReload = feedback.reloadAfterDismiss;
      setFeedback(null);

      if (shouldReload) {
        window.location.reload();
      }
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [feedback]);

  const showFeedback = (message, options = {}) => {
    setFeedback({
      type: options.type || "success",
      message,
      reloadAfterDismiss: Boolean(options.reloadAfterDismiss),
    });
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
        onSuccessToast={showFeedback}
      />

      {feedback?.message ? (
        <div className="pointer-events-none fixed right-5 top-5 z-[100] max-w-sm">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-sm transition-all duration-200 ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-600 text-white"
                : "border-rose-200 bg-rose-600 text-white"
            }`}
          >
            {feedback.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MainLayout;
