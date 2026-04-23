import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";

const WELCOME_MSG = {
  role: "assistant",
  content:
    "Xin chào! Tôi là Jelly 👋 — trợ lý tài chính cá nhân của bạn.\n" +
    "Tôi có thể giúp bạn phân tích chi tiêu, đọc hóa đơn, hoặc tư vấn tiết kiệm.\n" +
    "Hãy nhập câu hỏi hoặc gửi ảnh hóa đơn để bắt đầu nhé!",
};

const STORAGE_KEY = "jelly_chat_session_v1";

const loadFromStorage = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.messages) return null;
    return parsed;
  } catch {
    return null;
  }
};

const ChatSessionContext = createContext(null);

export function ChatSessionProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const initial = loadFromStorage();

  const [messages, setMessages] = useState(initial?.messages || [WELCOME_MSG]);
  const [sessionId, setSessionId] = useState(initial?.sessionId || null);

  // Xoá lịch sử khi đăng xuất
  useEffect(() => {
    if (!isAuthenticated) {
      setMessages([WELCOME_MSG]);
      setSessionId(null);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [isAuthenticated]);

  // Mirror xuống sessionStorage để F5 không mất
  useEffect(() => {
    if (!isAuthenticated) return;
    // Không lưu imagePreview (blob URL hết hạn sau reload)
    const serializable = messages.map(({ imagePreview: _ip, ...rest }) => rest);
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ messages: serializable, sessionId })
    );
  }, [messages, sessionId, isAuthenticated]);

  const resetChat = () => {
    setMessages([WELCOME_MSG]);
    setSessionId(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({ messages, setMessages, sessionId, setSessionId, resetChat }),
    [messages, sessionId]
  );

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSession() {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error("useChatSession must be used within ChatSessionProvider");
  return ctx;
}
