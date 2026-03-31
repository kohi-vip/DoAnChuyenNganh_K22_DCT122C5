import { AlertCircle, CheckCircle2 } from "lucide-react";

function NotificationDialog({ open, type = "success", title, message, onClose }) {
  if (!open) {
    return null;
  }

  const isSuccess = type === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center gap-3">
          <div
            className={`rounded-full p-2 ${
              isSuccess ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
            }`}
          >
            {isSuccess ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{title || (isSuccess ? "Thành công" : "Thông báo")}</h3>
        </div>

        <p className="text-sm text-slate-600">{message}</p>

        <div className="mt-6 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
              isSuccess ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationDialog;