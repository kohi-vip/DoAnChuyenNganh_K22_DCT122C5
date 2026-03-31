import { TriangleAlert, TrendingUp } from "lucide-react";

const formatCurrencyVnd = (value) => `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} VNĐ`;

function TopInsightsPanel({ topCategories, comparisonText, largeTransactions }) {
  const maxCategory = topCategories[0]?.value || 1;

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 md:text-base">Top 5 danh mục chi tiêu</h3>
        {topCategories.length === 0 ? (
          <p className="text-sm text-slate-500">Không có dữ liệu danh mục trong khoảng lọc.</p>
        ) : (
          <div className="space-y-3">
            {topCategories.map((item, index) => {
              const ratio = Math.max(0, Math.min(100, (item.value / maxCategory) * 100));

              return (
                <div key={item.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{index + 1}. {item.name}</span>
                    <span className="text-slate-500">{formatCurrencyVnd(item.value)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${ratio}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-slate-800">
          <TrendingUp className="h-4 w-4" />
          <h3 className="text-sm font-semibold md:text-base">So sánh với tháng trước</h3>
        </div>
        <p className="text-sm text-slate-600">{comparisonText}</p>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-slate-800">
          <TriangleAlert className="h-4 w-4" />
          <h3 className="text-sm font-semibold md:text-base">Giao dịch bất thường</h3>
        </div>
        {largeTransactions.length === 0 ? (
          <p className="text-sm text-slate-500">Không phát hiện giao dịch vượt ngưỡng bất thường.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-600">
            {largeTransactions.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-800">{item.name}</p>
                <p>{formatCurrencyVnd(item.amount)}</p>
                <p className="text-xs text-slate-500">{new Date(item.date).toLocaleDateString("vi-VN")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default TopInsightsPanel;
