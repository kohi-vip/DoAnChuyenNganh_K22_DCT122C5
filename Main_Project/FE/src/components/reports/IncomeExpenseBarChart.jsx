import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatShortVnd = (value) => {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}M`;
  }
  if (absolute >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return `${value}`;
};

const formatCurrencyVnd = (value) => `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} VNĐ`;

function IncomeExpenseBarChart({ data }) {
  const hasData = data.some((item) => item.income > 0 || item.expense > 0);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 md:text-base">So sánh Thu - Chi theo tháng</h3>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }} barGap={10} barCategoryGap="32%">
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis tickFormatter={formatShortVnd} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} width={56} />
            <Tooltip
              formatter={(value, name) => [formatCurrencyVnd(value), name === "income" ? "Thu" : "Chi"]}
              contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" formatter={(value) => (value === "income" ? "Thu" : "Chi")} />
            <Bar dataKey="income" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expense" fill="#94a3b8" radius={[6, 6, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {!hasData ? <p className="mt-2 text-sm text-slate-500">Không có dữ liệu trong khoảng thời gian đã chọn.</p> : null}
    </section>
  );
}

export default IncomeExpenseBarChart;
