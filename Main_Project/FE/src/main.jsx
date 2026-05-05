import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppDataProvider } from "./stores/AppDataContext";
import { AuthProvider } from "./stores/AuthContext";
import { ChatSessionProvider } from "./stores/ChatSessionContext";
import { NotificationProvider } from "./stores/NotificationContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <AppDataProvider>
        <ChatSessionProvider>
          <NotificationProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </NotificationProvider>
        </ChatSessionProvider>
      </AppDataProvider>
    </AuthProvider>
  </React.StrictMode>
);
