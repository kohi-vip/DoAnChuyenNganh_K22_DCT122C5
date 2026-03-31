import { CalendarRange } from "lucide-react";

function ReportsFilters({
  mode,
  onModeChange,
  monthValue,
  onMonthChange,
  yearValue,
  onYearChange,
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
}) {
  const nowYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, index) => String(nowYear - 5 + index));

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-slate-800">
        <CalendarRange className="h-4 w-4" />
        <h2 className="text-sm font-semibold md:text-base">Bộ lọc thời gian</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chế độ lọc</span>
          <select
            value={mode}
            onChange={(event) => onModeChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="month">Theo tháng</option>
            <option value="year">Theo năm</option>
            <option value="custom">Tùy chỉnh khoảng ngày</option>
          </select>
        </label>

        {mode === "month" ? (
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tháng</span>
            <input
              type="month"
              value={monthValue}
              onChange={(event) => onMonthChange(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            />
          </label>
        ) : null}

        {mode === "year" ? (
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Năm</span>
            <select
              value={yearValue}
              onChange={(event) => onYearChange(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === "custom" ? (
          <>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Từ ngày</span>
              <input
                type="date"
                value={customFrom}
                onChange={(event) => onCustomFromChange(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Đến ngày</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => onCustomToChange(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              />
            </label>
          </>
        ) : null}
      </div>
    </section>
  );
}

export default ReportsFilters;
