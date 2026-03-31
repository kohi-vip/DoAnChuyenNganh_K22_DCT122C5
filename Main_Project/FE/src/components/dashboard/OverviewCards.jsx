const formatCurrencyVnd = (amount) => `${new Intl.NumberFormat("vi-VN").format(amount)} VND`;

function OverviewCards({ totalBalance, monthIncome, monthExpense }) {
  const cards = [
    {
      id: "total",
      label: "Tổng số dư hiện tại trên toàn bộ ví",
      value: formatCurrencyVnd(totalBalance),
      valueClassName: "text-blue-700",
    },
    {
      id: "income",
      label: "Thu nhập tháng này:",
      value: formatCurrencyVnd(monthIncome),
      valueClassName: "text-emerald-600",
    },
    {
      id: "expense",
      label: "Chi tiêu tháng này:",
      value: formatCurrencyVnd(monthExpense),
      valueClassName: "text-rose-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <article key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
          <p className={`mt-2 text-2xl font-bold ${card.valueClassName}`}>{card.value}</p>
        </article>
      ))}
    </div>
  );
}

export default OverviewCards;
