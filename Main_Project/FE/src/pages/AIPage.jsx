import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bot, BarChart2, FileSearch } from "lucide-react";
import JellyChatTab from "../components/ai/JellyChatTab";
import OcrTab from "../components/ai/OcrTab";
import InsightsTab from "../components/ai/InsightsTab";

const TABS = [
  {
    id: "chat",
    label: "Trợ lý Jelly",
    icon: Bot,
    description: "Chat AI tư vấn tài chính cá nhân",
  },
  {
    id: "ocr",
    label: "OCR Hóa đơn",
    icon: FileSearch,
    description: "Đọc hóa đơn và tự điền form thêm giao dịch để bạn xác nhận",
  },
  {
    id: "insights",
    label: "Phân tích AI",
    icon: BarChart2,
    description: "Xu hướng thu chi và cảnh báo bất thường",
  },
];

export default function AIPage() {
  const [activeTab, setActiveTab] = useState("chat");
  const { openCreateTransaction } = useOutletContext();

  const handlePrefillTransaction = (data) => {
    if (openCreateTransaction) {
      openCreateTransaction(data);
    }
  };

  const activeTabInfo = TABS.find((t) => t.id === activeTab);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Trợ lý AI Jelly</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {activeTabInfo?.description}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "chat" && (
          <div className="flex h-full flex-col">
            <JellyChatTab onPrefillTransaction={handlePrefillTransaction} />
          </div>
        )}
        {activeTab === "ocr" && (
          <div className="h-full overflow-y-auto pr-1">
            <OcrTab onPrefillTransaction={handlePrefillTransaction} />
          </div>
        )}
        {activeTab === "insights" && (
          <div className="h-full overflow-y-auto pr-1">
            <InsightsTab />
          </div>
        )}
      </div>
    </div>
  );
}
