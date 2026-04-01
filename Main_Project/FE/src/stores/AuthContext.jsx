import { useCallback, useEffect, useRef, useState } from "react";
import httpClient from "../api/httpClient";
import { AuthContext } from "./authContextObject";
import {
  clearAuthSession,
  getAuthSession,
  isEmailValid,
  isPasswordValid,
  setAuthSession,
} from "../utils/authSession";

const extractTokens = (data) => ({
  accessToken: data?.access_token || data?.accessToken || data?.tokens?.access_token || "",
  refreshToken: data?.refresh_token || data?.refreshToken || data?.tokens?.refresh_token || "",
  expiresInSeconds: Number(data?.expires_in || data?.expiresIn || 3600),
});

const extractUser = (data, fallbackEmail) => {
  const apiUser =
    data?.user ||
    data?.data?.user ||
    data?.profile ||
    (data?.id && data?.email ? data : null);

  if (apiUser) {
    return {
      id: apiUser.id || apiUser.user_id || "",
      email: apiUser.email || fallbackEmail,
      full_name: apiUser.full_name || apiUser.fullName || "",
    };
  }

  return {
    id: "",
    email: fallbackEmail,
    full_name: "",
  };
};

const fetchCurrentUser = async (fallbackEmail = "") => {
  const response = await httpClient.get("/api/auth/me");
  return extractUser(response.data, fallbackEmail);
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getAuthSession());
  const hydratedProfileRef = useRef(false);

  const persistSession = useCallback(({ user, accessToken, refreshToken, expiresInSeconds = 3600 }) => {
    const nextSession = setAuthSession({ user, accessToken, refreshToken, expiresInSeconds });
    setSession(nextSession);
    return nextSession;
  }, []);

  const syncSessionUser = useCallback((sessionValue, nextUser) => {
    if (!sessionValue?.access_token || !sessionValue?.refresh_token || !sessionValue?.expires_at) {
      return;
    }

    const remainingSeconds = Math.max(1, Math.floor((sessionValue.expires_at - Date.now()) / 1000));
    persistSession({
      user: nextUser,
      accessToken: sessionValue.access_token,
      refreshToken: sessionValue.refresh_token,
      expiresInSeconds: remainingSeconds,
    });
  }, [persistSession]);

  useEffect(() => {
    if (!session?.access_token || hydratedProfileRef.current) {
      return undefined;
    }

    hydratedProfileRef.current = true;

    let isMounted = true;

    const hydrateCurrentUser = async () => {
      try {
        const currentUser = await fetchCurrentUser(session?.user?.email || "");
        if (isMounted) {
          syncSessionUser(session, currentUser);
        }
      } catch {
        if (isMounted) {
          clearAuthSession();
          setSession(null);
        }
      }
    };

    hydrateCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [session, syncSessionUser]);

  useEffect(() => {
    if (!session?.expires_at) {
      return undefined;
    }

    const delay = session.expires_at - Date.now();
    if (delay <= 0) {
      const expireNowTimer = window.setTimeout(() => {
        clearAuthSession();
        setSession(null);
      }, 0);
      return () => window.clearTimeout(expireNowTimer);
    }

    const timer = window.setTimeout(() => {
      clearAuthSession();
      setSession(null);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [session]);

  const login = async ({ email, password }) => {
    if (!isEmailValid(email)) {
      throw new Error("Email không hợp lệ.");
    }

    if (!isPasswordValid(password)) {
      throw new Error("Mật khẩu phải dài hơn 8 ký tự, gồm chữ hoa, chữ thường và số.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const response = await httpClient.post("/api/auth/login", {
      email: normalizedEmail,
      password,
    });

    const tokenBundle = extractTokens(response.data);
    if (!tokenBundle.accessToken || !tokenBundle.refreshToken) {
      throw new Error("Đăng nhập thất bại: thiếu access_token hoặc refresh_token.");
    }

    let nextSession = persistSession({
      user: extractUser(response.data, normalizedEmail),
      accessToken: tokenBundle.accessToken,
      refreshToken: tokenBundle.refreshToken,
      expiresInSeconds: tokenBundle.expiresInSeconds || 3600,
    });

    try {
      const currentUser = await fetchCurrentUser(normalizedEmail);
      syncSessionUser(nextSession, currentUser);
      nextSession = getAuthSession() || nextSession;
    } catch {
      // Keep optimistic session based on login response if profile endpoint fails temporarily.
    }

    return nextSession;
  };

  const register = async ({ lastName, firstName, email, password }) => {
    if (!isEmailValid(email)) {
      throw new Error("Email không hợp lệ.");
    }

    if (!isPasswordValid(password)) {
      throw new Error("Mật khẩu phải dài hơn 8 ký tự, gồm chữ hoa, chữ thường và số.");
    }

    const full_name = `${(lastName || "").trim()} ${(firstName || "").trim()}`.trim();
    if (!full_name) {
      throw new Error("Vui lòng nhập Họ và Tên.");
    }

    const registerPayload = {
      full_name,
      email: email.trim().toLowerCase(),
      password,
    };

    await httpClient.post("/api/auth/register", registerPayload);
    return login({ email: registerPayload.email, password });
  };

  const updateCurrentUser = (nextUserPatch) => {
    const currentUser = session?.user;
    if (!currentUser) {
      return;
    }

    const nextUser = { ...currentUser, ...nextUserPatch };
    syncSessionUser(session, nextUser);
  };

  const logout = () => {
    hydratedProfileRef.current = false;
    clearAuthSession();
    setSession(null);
  };

  const value = {
    user: session?.user || null,
    accessToken: session?.access_token || null,
    refreshToken: session?.refresh_token || null,
    expiresAt: session?.expires_at || null,
    isAuthenticated: Boolean(session?.access_token && session?.refresh_token),
    login,
    register,
    logout,
    updateCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
