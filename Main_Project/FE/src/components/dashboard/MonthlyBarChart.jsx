import { useMemo } from "react";
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

const getMonthWindow = (windowSize = 6) => {
  const now = new Date();
  const result = [];

  for (let offset = windowSize - 1; offset >= 0; offset -= 1) {
    const point = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    result.push({
      year: point.getFullYear(),
      month: point.getMonth(),
      key: `${point.getFullYear()}-${point.getMonth()}`,
      label: point.toLocaleDateString("en-US", { month: "short" }),
    });
  }

  return result;
};

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

const formatPreciseVnd = (value) => `${new Intl.NumberFormat("vi-VN").format(value)} VNĐ`;

function MonthlyBarChart({ transactions }) {
  const chartData = useMemo(() => {
    const monthWindow = getMonthWindow(6);
    const windowLookup = new Map(
      monthWindow.map((item) => [item.key, { month: item.label, income: 0, expense: 0 }])
    );

    transactions.forEach((item) => {
      if (item.type === "transfer" || item.is_reviewed === false) {
        return;
      }

      const date = new Date(item.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = windowLookup.get(key);
      if (!bucket) {
        return;
      }

      if (item.type === "income") {
        bucket.income += item.amount;
      }

      if (item.type === "expense") {
        bucket.expense += item.amount;
      }
    });

    return monthWindow.map((item) => windowLookup.get(item.key));
  }, [transactions]);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 md:text-base">Thu chi hàng tháng</h3>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 6, right: 8, left: 8, bottom: 6 }} barGap={12} barCategoryGap="36%">
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: "#cbd5e1" }}
              tick={{ fill: "#64748b", fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatShortVnd}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
              width={54}
            />
            <Tooltip
              formatter={(value, name) => [formatPreciseVnd(value), name === "income" ? "Thu" : "Chi"]}
              labelFormatter={(label) => `Tháng ${label}`}
              contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              formatter={(value) => (value === "income" ? "Thu" : "Chi")}
            />
            <Bar dataKey="income" name="income" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={24} />
            <Bar dataKey="expense" name="expense" fill="#94a3b8" radius={[6, 6, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default MonthlyBarChart;
