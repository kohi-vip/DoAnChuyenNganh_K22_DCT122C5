import { PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";

const formatCurrencyVnd = (amount) => `${new Intl.NumberFormat("vi-VN").format(Math.round(amount))} VNĐ`;

function MetricCard({ title, value, icon: Icon, valueClassName, children }) {
  return (
    <article className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className={`text-xl font-bold ${valueClassName}`}>{value}</p>
      {children}
    </article>
  );
}

function ReportsSummaryCards({ totalIncome, totalExpense, netBalance, savingsRate }) {
  const safeSavingsRate = Number.isFinite(savingsRate) ? savingsRate : 0;
  const progressWidth = Math.max(0, Math.min(100, safeSavingsRate));

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Tổng Thu" value={formatCurrencyVnd(totalIncome)} icon={TrendingUp} valueClassName="text-blue-700" />
      <MetricCard title="Tổng Chi" value={formatCurrencyVnd(totalExpense)} icon={TrendingDown} valueClassName="text-rose-600" />
      <MetricCard title="Số dư thuần" value={formatCurrencyVnd(netBalance)} icon={Wallet} valueClassName={netBalance >= 0 ? "text-emerald-600" : "text-rose-600"} />
      <MetricCard
        title="Tỷ lệ tiết kiệm"
        value={`${safeSavingsRate.toFixed(1)}%`}
        icon={PiggyBank}
        valueClassName={safeSavingsRate >= 0 ? "text-emerald-600" : "text-rose-600"}
      >
        <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
          <div
            className={`h-2 rounded-full transition-all ${safeSavingsRate >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </MetricCard>
    </div>
  );
}

export default ReportsSummaryCards;
