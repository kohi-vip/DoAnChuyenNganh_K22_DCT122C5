import { useEffect, useRef, useState } from "react";
import { Bot, ImagePlus, Loader2, Plus, Send, X } from "lucide-react";
import { jellyChat, ocrReceipt, parseTransactionText } from "../../api/financeApi";
import { useChatSession } from "../../stores/ChatSessionContext";

const formatCurrencyVnd = (value) => `${new Intl.NumberFormat("vi-VN").format(Math.round(Number(value || 0)))} VND`;

const formatSuggestionDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("vi-VN");
};

const removeVietnameseTone = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const shouldParseTransactionMessage = (text) => {
  const normalized = removeVietnameseTone(text || "");
  const hasMoney = /(\d+([.,]\d+)?\s*(k|nghin|ngan|tr|trieu|vnd|d|dong)|\d{4,})/.test(normalized);
  const hasTransactionIntent =
    /(tao|them|ghi|nhap|luu|chi|tieu|mua|tra|thanh toan|thu|nhan|luong|ban|chuyen khoan|an|uong|cafe|xang)/.test(
      normalized
    );

  return hasMoney && hasTransactionIntent;
};

const buildOcrSuggestion = (result) => {
  const amount = Number(result?.amount || 0);
  if (!amount) {
    return null;
  }

  const note = result.note || (result.vendor ? `Hóa đơn ${result.vendor}` : "Từ hóa đơn trong chat");

  return {
    source: "ocr",
    title: "Jelly nhận diện hóa đơn",
    status: "pending",
    prefill: {
      amount,
      note,
      suggested_category: result.suggested_category,
      transacted_at: result.transacted_at || result.date,
      type: "expense",
      vendor: result.vendor,
    },
    extracted: {
      amount,
      vendor: result.vendor,
      date: result.transacted_at || result.date,
      category: result.suggested_category,
      note,
      needsReview: result.needs_review,
    },
  };
};

const buildTextSuggestion = (parsed, sourceText) => {
  const amount = Number(parsed?.amount || 0);
  if (!amount) {
    return null;
  }

  const type = parsed.type === "income" || parsed.type === "expense" ? parsed.type : "expense";
  const note = parsed.note || sourceText;

  return {
    source: "text",
    title: "Jelly nhận diện yêu cầu tạo giao dịch",
    status: "pending",
    prefill: {
      amount,
      note,
      suggested_category: parsed.category,
      category: parsed.category,
      transacted_at: parsed.transacted_at,
      type,
    },
    extracted: {
      amount,
      type,
      date: parsed.transacted_at,
      category: parsed.category,
      note,
      needsReview: parsed.confidence != null && parsed.confidence < 0.8,
    },
  };
};

const detectTransactionSuggestion = async ({ text, imageFile }) => {
  if (imageFile) {
    const result = await ocrReceipt(imageFile);
    return buildOcrSuggestion(result);
  }

  if (!shouldParseTransactionMessage(text)) {
    return null;
  }

  const parsed = await parseTransactionText(text);
  return buildTextSuggestion(parsed, text);
};

function TransactionSuggestionCard({ suggestion, onCreate, onDismiss }) {
  if (!suggestion) {
    return null;
  }

  if (suggestion.status === "dismissed") {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Đã hủy gợi ý tạo giao dịch.
      </div>
    );
  }

  const extracted = suggestion.extracted || {};
  const suggestedType = suggestion.prefill?.type || "expense";
  const formattedDate = formatSuggestionDate(extracted.date);

  return (
    <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50 p-3 text-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{suggestion.title}</p>
      <div className="mt-2 space-y-1.5 text-xs text-slate-600">
        <p>
          <span className="font-medium text-slate-700">Số tiền:</span> {formatCurrencyVnd(extracted.amount)}
        </p>
        {extracted.vendor ? (
          <p>
            <span className="font-medium text-slate-700">Nguồn:</span> {extracted.vendor}
          </p>
        ) : null}
        {extracted.category ? (
          <p>
            <span className="font-medium text-slate-700">Danh mục gợi ý:</span> {extracted.category}
          </p>
        ) : null}
        {formattedDate ? (
          <p>
            <span className="font-medium text-slate-700">Thời gian:</span> {formattedDate}
          </p>
        ) : null}
        {extracted.note ? (
          <p>
            <span className="font-medium text-slate-700">Ghi chú:</span> {extracted.note}
          </p>
        ) : null}
        {extracted.needsReview ? (
          <p className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">
            Jelly chỉ điền nháp, bạn cần kiểm tra lại trước khi lưu.
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCreate("expense")}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            suggestedType === "expense"
              ? "bg-rose-600 text-white hover:bg-rose-700"
              : "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Tạo giao dịch chi
        </button>
        <button
          type="button"
          onClick={() => onCreate("income")}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            suggestedType === "income"
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Tạo giao dịch thu
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ msg, onCreateTransaction, onDismissSuggestion }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "rounded-tr-none bg-blue-600 text-white"
            : "rounded-tl-none bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
        }`}
      >
        {msg.imagePreview && (
          <img
            src={msg.imagePreview}
            alt="Hóa đơn đã gửi"
            className="mb-2 max-h-32 rounded-lg object-cover"
          />
        )}
        {msg.content}
        {!isUser && msg.transactionSuggestion ? (
          <TransactionSuggestionCard
            suggestion={msg.transactionSuggestion}
            onCreate={onCreateTransaction}
            onDismiss={onDismissSuggestion}
          />
        ) : null}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-none bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
      </div>
    </div>
  );
}

export default function JellyChatTab({ onPrefillTransaction }) {
  const { messages, setMessages, sessionId, setSessionId } = useChatSession();
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState(null); // { file, previewUrl }
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Chỉ hỗ trợ file ảnh (jpg, png, webp...)");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setSelectedImage({ file, previewUrl });
    setError(null);
    // Reset input để cho phép chọn lại cùng file
    e.target.value = "";
  };

  const removeImage = () => {
    if (selectedImage?.previewUrl) URL.revokeObjectURL(selectedImage.previewUrl);
    setSelectedImage(null);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !selectedImage) return;
    if (isLoading) return;

    const userMsg = {
      role: "user",
      content: text || "(Gửi ảnh hóa đơn để phân tích)",
      imagePreview: selectedImage?.previewUrl || null,
    };
    setMessages((prev) => [...prev, userMsg]);
    const imageFile = selectedImage?.file || null;
    const capturedPreviewUrl = selectedImage?.previewUrl;
    setInput("");
    setSelectedImage(null);
    setIsLoading(true);
    setError(null);

    const chatPromise = jellyChat({
      message: text || "Phân tích hóa đơn trong ảnh này cho tôi.",
      sessionId,
      imageFile,
    });

    const suggestionPromise = detectTransactionSuggestion({ text, imageFile }).catch(() => null);

    try {
      const [chatResult, suggestionResult] = await Promise.allSettled([chatPromise, suggestionPromise]);
      const suggestion = suggestionResult.status === "fulfilled" ? suggestionResult.value : null;

      if (chatResult.status === "fulfilled") {
        const res = chatResult.value;
        setSessionId(res.session_id);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.reply,
            transactionSuggestion: suggestion,
          },
        ]);
      } else {
        const detail =
          chatResult.reason?.response?.data?.detail || "Jelly tạm thời không phản hồi. Thử lại sau nhé!";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: suggestion
              ? `${detail}\nMình vẫn nhận diện được thông tin giao dịch bên dưới. Vui lòng kiểm tra lại trước khi tạo.`
              : detail,
            transactionSuggestion: suggestion,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      // Giải phóng object URL sau khi gửi xong
      if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
      textareaRef.current?.focus();
    }
  };

  const handleCreateFromSuggestion = (suggestion, forcedType) => {
    if (!suggestion?.prefill || !onPrefillTransaction) {
      return;
    }

    onPrefillTransaction({
      ...suggestion.prefill,
      type: forcedType,
    });
  };

  const dismissSuggestionAt = (index) => {
    setMessages((prev) =>
      prev.map((msg, currentIndex) => {
        if (currentIndex !== index || !msg.transactionSuggestion) {
          return msg;
        }

        return {
          ...msg,
          transactionSuggestion: {
            ...msg.transactionSuggestion,
            status: "dismissed",
          },
        };
      })
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 py-2">
        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            msg={msg}
            onCreateTransaction={(type) => handleCreateFromSuggestion(msg.transactionSuggestion, type)}
            onDismissSuggestion={() => dismissSuggestionAt(i)}
          />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Image preview + warning */}
      {selectedImage && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <img
                src={selectedImage.previewUrl}
                alt="Xem trước hóa đơn"
                className="h-16 w-16 rounded-lg object-cover ring-2 ring-amber-300"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow hover:bg-rose-600"
                aria-label="Xóa ảnh"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="text-xs text-amber-700">
              <p className="font-semibold">📎 {selectedImage.file.name}</p>
              <p className="text-amber-600">Chỉ gửi được 1 hóa đơn mỗi lần. Ảnh sẽ gửi kèm tin nhắn.</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-rose-500">{error}</p>
      )}

      {/* Input row */}
      <div className="mt-3 flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {/* Ảnh */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Đính kèm hóa đơn (1 ảnh)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-teal-600 disabled:opacity-40"
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhắn với Jelly… (Enter để gửi, Shift+Enter xuống dòng)"
          className="flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          style={{ maxHeight: "120px", overflowY: "auto" }}
          disabled={isLoading}
        />

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || (!input.trim() && !selectedImage)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white transition hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
