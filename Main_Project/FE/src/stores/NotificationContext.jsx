/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fetchUnreadNotificationCount } from "../api/financeApi";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const mountedRef = useRef(true);
  const refreshNotificationsRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;

    const doFetch = async () => {
      try {
        const count = await fetchUnreadNotificationCount();
        if (mountedRef.current) {
          setUnreadCount(count);
          if (refreshNotificationsRef.current) {
            refreshNotificationsRef.current();
          }
        }
      } catch {
        if (mountedRef.current) {
          setUnreadCount(0);
        }
      }
    };

    doFetch();
    const timer = window.setInterval(doFetch, 1000);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
    };
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await fetchUnreadNotificationCount();
      if (mountedRef.current) {
        setUnreadCount(count);
      }
    } catch {
      // silently fail
    }
  }, []);

  const registerRefreshNotifications = useCallback((fn) => {
    refreshNotificationsRef.current = fn;
  }, []);

  const unregisterRefreshNotifications = useCallback(() => {
    refreshNotificationsRef.current = null;
  }, []);

  const value = {
    unreadCount,
    refreshUnreadCount,
    registerRefreshNotifications,
    unregisterRefreshNotifications,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotificationContext must be used within NotificationProvider");
  }
  return context;
}
