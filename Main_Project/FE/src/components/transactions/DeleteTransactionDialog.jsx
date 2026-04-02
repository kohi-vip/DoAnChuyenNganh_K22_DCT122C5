import { AlertTriangle } from "lucide-react";

function DeleteTransactionDialog({ open, transactionName, onCancel, onConfirm }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-full bg-rose-100 p-2 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Xác nhận xóa giao dịch</h3>
        </div>

        <p className="text-sm text-slate-600">
          Bạn có chắc chắn muốn xóa giao dịch <span className="font-semibold text-slate-900">{transactionName}</span>?
          Số dư ví sẽ được hoàn tác tương ứng.
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Xóa giao dịch
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteTransactionDialog;
