import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import seedData from "../../utils/seedData";

const toMonthInputValue = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
};

const formatShortVnd = (value) => {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}tr`;
  }

  if (absolute >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }

  return `${value}`;
};

const formatCurrencyVnd = (value) => `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} VNĐ`;

const buildDailyExpenseData = (transactions, selectedMonth) => {
  const [year, month] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const amountByDay = new Map(Array.from({ length: daysInMonth }, (_, i) => [i + 1, 0]));

  transactions.forEach((item) => {
    const date = new Date(item.date || item.transacted_at);
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) {
      return;
    }

    if (item.type !== "expense") {
      return;
    }

    if (item.type === "transfer") {
      return;
    }

    if (item.is_reviewed !== true) {
      return;
    }

    const day = date.getDate();
    amountByDay.set(day, (amountByDay.get(day) || 0) + item.amount);
  });

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return {
      day,
      label: `${day}`,
      amount: amountByDay.get(day) || 0,
    };
  });
};

function DailyExpenseLineChart({ transactions }) {
  const sourceTransactions = transactions && transactions.length > 0 ? transactions : seedData.transactions;
  const [selectedMonth, setSelectedMonth] = useState(toMonthInputValue(new Date()));

  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 18 }, (_, index) => {
      const target = new Date(now.getFullYear(), now.getMonth() - index, 1);
      return {
        value: toMonthInputValue(target),
        label: `Tháng ${`${target.getMonth() + 1}`.padStart(2, "0")}/${target.getFullYear()}`,
      };
    });
  }, []);

  const chartData = useMemo(
    () => buildDailyExpenseData(sourceTransactions, selectedMonth),
    [sourceTransactions, selectedMonth]
  );

  const ticks = useMemo(() => {
    const maxDay = chartData.length;
    const baseTicks = [1, 5, 10, 15, 20, 25, 30].filter((day) => day <= maxDay);
    if (maxDay > 0 && !baseTicks.includes(maxDay)) {
      baseTicks.push(maxDay);
    }
    return baseTicks;
  }, [chartData]);

  const hasData = chartData.some((item) => item.amount > 0);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 md:text-base">Tổng quan chi tiêu</h3>

        <label className="relative inline-flex min-w-[180px] items-center">
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-700 outline-none transition focus:border-blue-500"
          >
            {monthOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
        </label>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
            <defs>
              <linearGradient id="dailyExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              ticks={ticks}
              tickLine={false}
              axisLine={{ stroke: "#cbd5e1" }}
              tick={{ fill: "#64748b", fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatShortVnd}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
              width={58}
            />
            <Tooltip
              formatter={(value) => [formatCurrencyVnd(value), "Chi tiêu"]}
              labelFormatter={(value) => `Ngày ${value}`}
              contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#dailyExpenseGradient)"
              dot={{ r: 3.5, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {!hasData ? <p className="mt-2 text-sm text-slate-500">Không có dữ liệu chi tiêu cho tháng đã chọn.</p> : null}
    </section>
  );
}

export default DailyExpenseLineChart;
