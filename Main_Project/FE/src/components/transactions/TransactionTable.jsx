import {
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Repeat,
  Trash2,
} from "lucide-react";

const formatCompactAmount = (amount, type) => {
  const value = Math.round(amount / 1000);
  if (type === "expense") {
    return `-${value}k`;
  }
  if (type === "income") {
    return `+${value}k`;
  }
  return `${value}k`;
};

const formatDate = (isoDate) =>
  new Date(isoDate).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

function TransactionTable({
  rows,
  page,
  totalPages,
  selectedIds,
  onToggleAllCurrentPage,
  onToggleRow,
  onChangePage,
  getWalletName,
  getCategoryMeta,
  onEdit,
  onDelete,
}) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1300px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="border-b border-slate-200 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAllCurrentPage}
                  aria-label="Chọn tất cả giao dịch trong trang"
                />
              </th>
              <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700">Tên giao dịch</th>
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
              const category = getCategoryMeta(row.categoryId);
              const isUnreviewedAutoSync = row.source === "auto_sync" && !row.is_reviewed;

              return (
                <tr
                  key={row.id}
                  className={`border-b border-slate-100 transition hover:bg-slate-50 ${
                    isUnreviewedAutoSync ? "bg-amber-50/60" : ""
                  }`}
                >
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
                          <Repeat className="h-4 w-4" />
                        )}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-800">{row.name}</p>
                        <p className="text-xs text-slate-500">
                          {row.source === "manual" ? "Thủ công" : row.source === "auto_sync" ? "Tự đồng bộ" : "Chuyển khoản nội bộ"}
                          {isUnreviewedAutoSync ? " • Chưa review" : ""}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3 align-top text-slate-600">{row.description}</td>
                  <td className="px-3 py-3 align-top text-slate-700">{formatDate(row.transacted_at || row.date)}</td>
                  <td
                    className={`px-3 py-3 align-top font-semibold ${
                      row.type === "expense"
                        ? "text-rose-600"
                        : row.type === "income"
                        ? "text-emerald-600"
                        : "text-sky-700"
                    }`}
                  >
                    {formatCompactAmount(row.amount, row.type)}
                  </td>
                  <td className="px-3 py-3 align-top text-slate-700">
                    {row.type === "income"
                      ? "Thu nhập"
                      : row.type === "expense"
                      ? "Chi tiêu"
                      : "Chuyển khoản"}
                  </td>
                  <td className="px-3 py-3 align-top text-slate-700">{getWalletName(row.walletId)}</td>
                  <td className="px-3 py-3 align-top">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: `${category.color}22`, color: category.color }}
                    >
                      {category.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                        aria-label="Sửa giao dịch"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                        aria-label="Xóa giao dịch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <button
          type="button"
          onClick={() => onChangePage(Math.max(1, page - 1))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          disabled={page === 1}
        >
          Trước
        </button>

        <div className="flex flex-wrap items-center gap-1">
          {pageNumbers.map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => onChangePage(number)}
              className={`h-8 min-w-8 rounded-md px-2 text-sm ${
                number === page
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {number}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onChangePage(Math.min(totalPages, page + 1))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          disabled={page === totalPages}
        >
          Sau
        </button>
      </div>
    </section>
  );
}

export default TransactionTable;
