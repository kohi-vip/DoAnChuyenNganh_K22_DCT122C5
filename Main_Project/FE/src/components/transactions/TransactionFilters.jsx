function TransactionFilters({
  draftFilters,
  onChangeDraft,
  onApplyFilters,
  walletOptions,
  parentCategoryOptions,
  childCategoryOptions,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Từ ngày</label>
          <input
            type="date"
            value={draftFilters.dateFrom}
            onChange={(event) => onChangeDraft("dateFrom", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Đến ngày</label>
          <input
            type="date"
            value={draftFilters.dateTo}
            onChange={(event) => onChangeDraft("dateTo", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Phân loại giao dịch</label>
          <select
            value={draftFilters.transactionKind}
            onChange={(event) => onChangeDraft("transactionKind", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="all">Tất cả giao dịch</option>
            <option value="regular">Giao dịch thường</option>
            <option value="recurring">Giao dịch định kỳ</option>
          </select>
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
          <label className="mb-1 block text-xs font-semibold text-slate-600">Danh mục cha</label>
          <select
            value={draftFilters.parentCategoryId}
            onChange={(event) => onChangeDraft("parentCategoryId", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="all">Tất cả danh mục</option>
            {parentCategoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Danh mục con</label>
          <select
            value={draftFilters.childCategoryId}
            onChange={(event) => onChangeDraft("childCategoryId", event.target.value)}
            disabled={
              draftFilters.parentCategoryId === "all" ||
              draftFilters.parentCategoryId === "cat_transfer" ||
              childCategoryOptions.length === 0
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="all">Tất cả danh mục con</option>
            {childCategoryOptions.map((category) => (
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
            className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Lọc dữ liệu
          </button>
        </div>
      </div>
    </section>
  );
}

export default TransactionFilters;
