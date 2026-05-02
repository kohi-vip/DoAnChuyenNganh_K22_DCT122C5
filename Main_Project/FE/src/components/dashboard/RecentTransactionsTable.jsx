import {
  ArrowDownAZ,
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  Pencil,
  Trash2,
} from "lucide-react";

const formatDateTime = (isoDate) => {
  const date = new Date(isoDate);
  const hours = date.getHours();
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return `${hour12}:${minutes}${period} ${day}/${month}/${year}`;
};

const formatAmount = (amount, type, transferDirection) => {
  const value = Math.round(amount / 1000);

  if (type === "transfer") {
    if (transferDirection === "in") {
      return `+${value}k`;
    }
    if (transferDirection === "out") {
      return `-${value}k`;
    }
    return `${value}k`;
  }

  if (type === "expense") {
    return `-${value}k`;
  }

  if (type === "income") {
    return `+${value}k`;
  }

  return `${value}k`;
};

function RecentTransactionsTable({
  rows,
  selectedIds,
  onToggleAllRows,
  onToggleRow,
  onEdit,
  onDelete,
}) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1200px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="border-b border-slate-200 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAllRows}
                  aria-label="Chọn tất cả giao dịch gần đây"
                />
              </th>
              <th className="border-b border-slate-200 px-3 py-3">
                <div className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  Tên giao dịch
                  <ArrowDownAZ className="h-4 w-4" />
                </div>
              </th>
              <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700">Mô tả</th>
              <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700">Ngày giao dịch</th>
              <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700">Số tiền giao dịch</th>
              <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700">Loại</th>
              <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700">Ví</th>
              <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700">Danh mục</th>
              <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700">Hành động</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isTransferRow = row.type === "transfer";
              return (
                <tr key={row.id} className="border-b border-slate-100 transition hover:bg-slate-50">
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => onToggleRow(row.id)}
                    />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${
                          row.type === "expense"
                            ? "bg-rose-100 text-rose-600"
                            : row.type === "income"
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-sky-100 text-sky-600"
                        }`}
                      >
                        {row.type === "expense" ? (
                          <ArrowDownCircle className="h-4 w-4" />
                        ) : row.type === "income" ? (
                          <ArrowUpCircle className="h-4 w-4" />
                        ) : (
                          <ArrowRightLeft className="h-4 w-4" />
                        )}
                      </span>
                      <p className="font-semibold text-slate-800">{row.name}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top text-slate-600">{row.note}</td>
                  <td className="px-3 py-3 align-top text-slate-700">{formatDateTime(row.transacted_at)}</td>
                  <td
                    className={`px-3 py-3 align-top font-semibold ${
                      row.type === "expense"
                        ? "text-rose-600"
                        : row.type === "income"
                        ? "text-emerald-600"
                        : "text-sky-700"
                    }`}
                  >
                    {formatAmount(row.amount, row.type, row.transferDirection)}
                  </td>
                  <td className="px-3 py-3 align-top text-slate-700">
                    {row.type === "income" ? "Thu" : row.type === "expense" ? "Chi" : "Chuyển khoản"}
                  </td>
                  <td className="px-3 py-3 align-top text-slate-700">{row.wallet_name}</td>
                  <td className="px-3 py-3 align-top">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: `${row.category_color}22`, color: row.category_color }}
                    >
                      {row.category_name}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    {isTransferRow ? (
                      <span className="text-xs text-slate-400">Chỉ xem</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(row.rawTransaction)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                          aria-label="Sửa giao dịch"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row.rawTransaction)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                          aria-label="Xóa giao dịch"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default RecentTransactionsTable;
