import { useEffect, useState } from "react";
import { AlertTriangle, Lightbulb, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { fetchAiAnomalies, fetchAiInsights } from "../../api/financeApi";

function SectionCard({ icon: Icon, title, color, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function InsightsTab() {
  const [insights, setInsights] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);
  const [errorInsights, setErrorInsights] = useState(null);
  const [errorAnomalies, setErrorAnomalies] = useState(null);

  const loadInsights = async () => {
    setLoadingInsights(true);
    setErrorInsights(null);
    try {
      const data = await fetchAiInsights();
      setInsights(data);
    } catch (err) {
      setErrorInsights(err?.response?.data?.detail || "Không tải được phân tích.");
    } finally {
      setLoadingInsights(false);
    }
  };

  const loadAnomalies = async () => {
    setLoadingAnomalies(true);
    setErrorAnomalies(null);
    try {
      const data = await fetchAiAnomalies();
      setAnomalies(data);
    } catch (err) {
      setErrorAnomalies(err?.response?.data?.detail || "Không tải được cảnh báo.");
    } finally {
      setLoadingAnomalies(false);
    }
  };

  useEffect(() => {
    loadInsights();
    loadAnomalies();
  }, []);

  return (
    <div className="space-y-5">
      {/* Xu hướng thu chi */}
      <SectionCard icon={TrendingUp} title="Phân tích xu hướng" color="text-blue-600">
        {loadingInsights ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang phân tích dữ liệu...
          </div>
        ) : errorInsights ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-rose-600">{errorInsights}</p>
            <button
              type="button"
              onClick={loadInsights}
              className="ml-3 flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Thử lại
            </button>
          </div>
        ) : insights ? (
          <div className="space-y-3">
            {insights.period && (
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Giai đoạn: {insights.period}
              </p>
            )}
            <p className="text-sm leading-relaxed text-slate-700">{insights.analysis}</p>
            {insights.suggestions?.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Lightbulb className="h-3 w-3 text-amber-500" /> Gợi ý tiết kiệm
                </p>
                <ul className="space-y-1.5">
                  {insights.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </SectionCard>

      {/* Cảnh báo chi tiêu bất thường */}
      <SectionCard icon={AlertTriangle} title="Cảnh báo chi tiêu bất thường" color="text-amber-500">
        {loadingAnomalies ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang kiểm tra...
          </div>
        ) : errorAnomalies ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-rose-600">{errorAnomalies}</p>
            <button
              type="button"
              onClick={loadAnomalies}
              className="ml-3 flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Thử lại
            </button>
          </div>
        ) : anomalies?.total_found === 0 ? (
          <p className="text-sm text-emerald-600">
            Không phát hiện chi tiêu bất thường. Chi tiêu của bạn khá ổn định!
          </p>
        ) : anomalies?.anomalies?.length > 0 ? (
          <div className="space-y-3">
            {anomalies.anomalies.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{item.category}</span>
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    Z = {item.z_score}
                  </span>
                </div>
                <div className="mt-1 flex gap-4 text-xs text-slate-500">
                  <span>
                    Số tiền:{" "}
                    <strong className="text-slate-700">
                      {Number(item.amount).toLocaleString("vi-VN")} đ
                    </strong>
                  </span>
                  <span>
                    Trung bình:{" "}
                    <strong className="text-slate-700">
                      {Number(item.mean).toLocaleString("vi-VN")} đ
                    </strong>
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
