import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function TransactionEditModal({
  open,
  transaction,
  walletOptions,
  categoryOptions,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    if (!open || !transaction) {
      return;
    }

    setFormData({
      ...transaction,
      amount: String(transaction.amount),
      date: (transaction.transacted_at || transaction.date).slice(0, 10),
    });
  }, [open, transaction]);

  const canSubmit = useMemo(() => {
    if (!formData) {
      return false;
    }

    return (
      formData.name.trim().length > 0 &&
      formData.date &&
      Number(formData.amount) > 0 &&
      formData.walletId &&
      formData.categoryId
    );
  }, [formData]);

  if (!open || !formData) {
    return null;
  }

  const handleChange = (key, value) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    const nextTimestamp = `${formData.date}T00:00:00`;

    onSave({
      ...formData,
      amount: Number(formData.amount),
      date: nextTimestamp,
      transacted_at: nextTimestamp,
    });
  };

  const categoryList = categoryOptions.filter((item) => {
    if (formData.type === "transfer") {
      return item.id === "cat_transfer";
    }
    return item.type === formData.type;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Sửa giao dịch</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tên giao dịch</label>
              <input
                value={formData.name}
                onChange={(event) => handleChange("name", event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Ngày giao dịch</label>
              <input
                type="date"
                value={formData.date}
                onChange={(event) => handleChange("date", event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Số tiền</label>
              <input
                type="number"
                min="1"
                value={formData.amount}
                onChange={(event) => handleChange("amount", event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Loại giao dịch</label>
              <select
                value={formData.type}
                onChange={(event) => {
                  const nextType = event.target.value;
                  handleChange("type", nextType);
                  if (nextType === "transfer") {
                    handleChange("categoryId", "cat_transfer");
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="income">Thu nhập</option>
                <option value="expense">Chi tiêu</option>
                <option value="transfer">Chuyển khoản nội bộ</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Ví</label>
              <select
                value={formData.walletId}
                onChange={(event) => handleChange("walletId", event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
              >
                {walletOptions.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Danh mục</label>
              <select
                value={formData.categoryId}
                onChange={(event) => handleChange("categoryId", event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
              >
                {categoryList.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mô tả</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(event) => handleChange("description", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formData.source === "manual"}
                onChange={(event) => handleChange("source", event.target.checked ? "manual" : "auto_sync")}
              />
              Nguồn thủ công
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formData.is_reviewed}
                onChange={(event) => handleChange("is_reviewed", event.target.checked)}
              />
              Đã review
            </label>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            Lưu thay đổi
          </button>
        </form>
      </div>
    </div>
  );
}

export default TransactionEditModal;
