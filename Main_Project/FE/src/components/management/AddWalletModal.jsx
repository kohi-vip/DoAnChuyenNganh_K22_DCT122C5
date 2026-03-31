import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const presetColors = ["#ec4899", "#ef4444", "#f97316", "#2563eb", "#0ea5e9", "#10b981", "#8b5cf6"];

function AddWalletModal({ open, mode, initialData, onClose, onSubmitWallet }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [walletType, setWalletType] = useState("basic");
  const [provider, setProvider] = useState("Bank");
  const [color, setColor] = useState("#2563eb");

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "edit" && initialData) {
      setName(initialData.name ?? "");
      setBalance(String(initialData.balance ?? 0));
      setWalletType(initialData.type ?? "basic");
      setProvider(initialData.provider ?? "Bank");
      setColor(initialData.color ?? "#2563eb");
      return;
    }

    setName("");
    setBalance("");
    setWalletType("basic");
    setProvider("Bank");
    setColor("#2563eb");
  }, [open, mode, initialData]);

  const canSubmit = useMemo(() => {
    const hasBaseFields = name.trim().length > 0 && Number(balance) >= 0;
    if (!hasBaseFields) {
      return false;
    }
    if (walletType === "linked") {
      return provider.trim().length > 0;
    }
    return true;
  }, [name, balance, walletType, provider]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    onSubmitWallet({
      id: initialData?.id ?? `wallet_${Date.now()}`,
      name: name.trim(),
      balance: Number(balance),
      color,
      type: walletType,
      provider: walletType === "linked" ? provider : null,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {mode === "edit" ? "Sửa thông tin ví" : "Thêm ví mới"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tên ví</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
              placeholder="Ví tiết kiệm"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Số dư ban đầu</label>
            <input
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              type="number"
              min="0"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
              placeholder="5000000"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Loại ví</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setWalletType("basic")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  walletType === "basic" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
                }`}
              >
                Ví tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setWalletType("linked")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  walletType === "linked" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
                }`}
              >
                Ví liên kết
              </button>
            </div>
          </div>

          {walletType === "linked" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nhà cung cấp liên kết</label>
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
                required
              >
                <option value="Bank">Bank</option>
                <option value="MoMo">MoMo</option>
                <option value="ZaloPay">ZaloPay</option>
              </select>
            </div>
          ) : null}

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Màu sắc hiển thị</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {presetColors.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`h-7 w-7 rounded-full border-2 ${color === preset ? "border-slate-900" : "border-transparent"}`}
                  style={{ backgroundColor: preset }}
                  aria-label={`Chọn màu ${preset}`}
                />
              ))}
            </div>
            <input
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none transition focus:border-blue-500"
              placeholder="#2563eb"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={!canSubmit}
          >
            {mode === "edit" ? "Lưu thay đổi" : "Thêm ví"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddWalletModal;