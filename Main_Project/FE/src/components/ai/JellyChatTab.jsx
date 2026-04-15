import { useEffect, useRef, useState } from "react";
import { Bot, ImagePlus, Loader2, Send, X } from "lucide-react";
import { jellyChat } from "../../api/financeApi";
import { useChatSession } from "../../stores/ChatSessionContext";

function ChatBubble({ msg }) {
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

export default function JellyChatTab() {
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

    try {
      const res = await jellyChat({
        message: text || "Phân tích hóa đơn trong ảnh này cho tôi.",
        sessionId,
        imageFile,
      });
      setSessionId(res.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      const detail = err?.response?.data?.detail || "Jelly tạm thời không phản hồi. Thử lại sau nhé!";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${detail}` },
      ]);
    } finally {
      setIsLoading(false);
      // Giải phóng object URL sau khi gửi xong
      if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
      textareaRef.current?.focus();
    }
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
          <ChatBubble key={i} msg={msg} />
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
