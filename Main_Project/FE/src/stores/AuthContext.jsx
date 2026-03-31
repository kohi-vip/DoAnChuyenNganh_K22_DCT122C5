import { createContext, useContext, useEffect, useMemo, useState } from "react";
import httpClient from "../api/httpClient";
import { getLocalUsers, upsertLocalUser } from "../utils/localDataStore";
import {
  clearAuthSession,
  getAuthSession,
  isEmailValid,
  isPasswordValid,
  setAuthSession,
} from "../utils/authSession";

const AuthContext = createContext(null);

const extractTokens = (data) => ({
  accessToken: data?.access_token || data?.accessToken || data?.tokens?.access_token || "",
  refreshToken: data?.refresh_token || data?.refreshToken || data?.tokens?.refresh_token || "",
  expiresInSeconds: Number(data?.expires_in || data?.expiresIn || 3600),
});

const extractUser = (data, fallbackEmail) => {
  const apiUser = data?.user || data?.data?.user || data?.profile;

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

const loginWithSeedUser = ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const matched = getLocalUsers().find(
    (user) => user.email.toLowerCase() === normalizedEmail && user.password === password
  );

  if (!matched) {
    return null;
  }

  return {
    user: {
      id: matched.id,
      email: matched.email,
      full_name: matched.full_name,
    },
    accessToken: `dev_access_${Date.now()}`,
    refreshToken: `dev_refresh_${Date.now()}`,
    expiresInSeconds: 3600,
  };
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getAuthSession());

  const syncSessionUser = (nextUser) => {
    if (!session?.access_token || !session?.refresh_token) {
      return;
    }

    const remainingSeconds = Math.max(1, Math.floor((session.expires_at - Date.now()) / 1000));
    const nextSession = setAuthSession({
      user: nextUser,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresInSeconds: remainingSeconds,
    });
    setSession(nextSession);
  };

  useEffect(() => {
    if (!session?.expires_at) {
      return undefined;
    }

    const delay = session.expires_at - Date.now();
    if (delay <= 0) {
      clearAuthSession();
      setSession(null);
      return undefined;
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

    let authPayload = null;

    try {
      const response = await httpClient.post("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      const tokenBundle = extractTokens(response.data);
      if (!tokenBundle.accessToken || !tokenBundle.refreshToken) {
        throw new Error("Đăng nhập thất bại: thiếu access_token hoặc refresh_token.");
      }

      authPayload = {
        user: extractUser(response.data, email.trim().toLowerCase()),
        accessToken: tokenBundle.accessToken,
        refreshToken: tokenBundle.refreshToken,
        expiresInSeconds: tokenBundle.expiresInSeconds || 3600,
      };
    } catch (error) {
      const statusCode = error?.response?.status;
      if (statusCode !== 404) {
        throw error;
      }

      const seedFallback = loginWithSeedUser({ email, password });
      if (!seedFallback) {
        throw new Error("Không tìm thấy API đăng nhập và thông tin tài khoản seed cũng không khớp.");
      }

      authPayload = seedFallback;
    }

    const nextSession = setAuthSession({
      user: authPayload.user,
      accessToken: authPayload.accessToken,
      refreshToken: authPayload.refreshToken,
      expiresInSeconds: authPayload.expiresInSeconds,
    });

    setSession(nextSession);
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
      default_currency: "VND",
    };

    try {
      const response = await httpClient.post("/api/auth/register", registerPayload);

      const tokenBundle = extractTokens(response.data);

      if (tokenBundle.accessToken && tokenBundle.refreshToken) {
        const user = extractUser(response.data, registerPayload.email);
        const nextSession = setAuthSession({
          user,
          accessToken: tokenBundle.accessToken,
          refreshToken: tokenBundle.refreshToken,
          expiresInSeconds: tokenBundle.expiresInSeconds || 3600,
        });
        setSession(nextSession);
        return nextSession;
      }

      return login({ email: registerPayload.email, password });
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }

      const localUser = {
        id: `user_${Date.now()}`,
        email: registerPayload.email,
        password: registerPayload.password,
        full_name,
        default_currency: "VND",
        created_at: new Date().toISOString(),
      };

      upsertLocalUser(localUser);
      return login({ email: registerPayload.email, password });
    }
  };

  const updateCurrentUser = (nextUserPatch) => {
    const currentUser = session?.user;
    if (!currentUser) {
      return;
    }

    const nextUser = { ...currentUser, ...nextUserPatch };
    syncSessionUser(nextUser);
  };

  const logout = () => {
    clearAuthSession();
    setSession(null);
  };

  const value = useMemo(
    () => ({
      user: session?.user || null,
      accessToken: session?.access_token || null,
      refreshToken: session?.refresh_token || null,
      expiresAt: session?.expires_at || null,
      isAuthenticated: Boolean(session?.access_token && session?.refresh_token),
      login,
      register,
      logout,
      updateCurrentUser,
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
