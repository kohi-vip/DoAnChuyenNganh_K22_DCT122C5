function TransactionFilters({
  draftFilters,
  onChangeDraft,
  onApplyFilters,
  walletOptions,
  categoryOptions,
}) {
  const dateRangeInvalid =
    Boolean(draftFilters.dateFrom) &&
    Boolean(draftFilters.dateTo) &&
    draftFilters.dateFrom > draftFilters.dateTo;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Từ ngày</label>
          <input
            type="date"
            value={draftFilters.dateFrom}
            max={draftFilters.dateTo || undefined}
            onChange={(event) => onChangeDraft("dateFrom", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Đến ngày</label>
          <input
            type="date"
            value={draftFilters.dateTo}
            min={draftFilters.dateFrom || undefined}
            onChange={(event) => onChangeDraft("dateTo", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Lọc theo ví</label>
          <select
            value={draftFilters.walletId}
            onChange={(event) => onChangeDraft("walletId", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="all">Tất cả ví</option>
            {walletOptions.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Lọc danh mục</label>
          <select
            value={draftFilters.categoryId}
            onChange={(event) => onChangeDraft("categoryId", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="all">Tất cả danh mục</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Loại giao dịch</label>
          <select
            value={draftFilters.type}
            onChange={(event) => onChangeDraft("type", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="all">Tất cả</option>
            <option value="income">Thu nhập</option>
            <option value="expense">Chi tiêu</option>
            <option value="transfer">Chuyển khoản nội bộ</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={onApplyFilters}
            disabled={dateRangeInvalid}
            className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Lọc dữ liệu
          </button>
        </div>
      </div>

      {dateRangeInvalid ? (
        <p className="mt-2 text-xs font-medium text-rose-600">
          ⚠️ "Từ ngày" phải trước hoặc bằng "Đến ngày".
        </p>
      ) : null}
    </section>
  );
}

export default TransactionFilters;
