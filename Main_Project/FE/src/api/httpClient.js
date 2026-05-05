import axios from "axios";
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  clearAuthSession,
} from "../utils/authSession";

const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 15000,
});

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 15000,
});

let refreshPromise = null;

const refreshAccessToken = async () => {
  if (refreshPromise) {
    console.log("[httpClient] refreshPromise already exists, reusing");
    return refreshPromise;
  }

  console.log("[httpClient] creating new refreshPromise");
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error("Missing refresh token");
    }

    console.log("[httpClient] calling /api/auth/refresh");
    const response = await refreshClient.post("/api/auth/refresh", {
      refresh_token: refreshToken,
    });

    const nextAccessToken = response?.data?.access_token || response?.data?.accessToken;
    const nextRefreshToken = response?.data?.refresh_token || response?.data?.refreshToken || refreshToken;

    if (!nextAccessToken) {
      throw new Error("Refresh token response missing access_token");
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, nextAccessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);

    console.log("[httpClient] refresh successful, new token received");
    return nextAccessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

httpClient.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;
    const requestUrl = originalRequest?.url || "";

    console.log("[httpClient] response error:", status, requestUrl, "retry:", originalRequest?._retry);

    if (!originalRequest || status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const isAuthEndpoint =
      requestUrl.includes("/api/auth/login") ||
      requestUrl.includes("/api/auth/register") ||
      requestUrl.includes("/api/auth/refresh");

    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      console.log("[httpClient] attempting token refresh for:", requestUrl);
      const newAccessToken = await refreshAccessToken();
      console.log("[httpClient] refresh success, retrying:", requestUrl);
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return httpClient(originalRequest);
    } catch (refreshError) {
      console.log("[httpClient] refresh failed:", refreshError?.message);
      originalRequest._retry = false;
      clearAuthSession();
      return Promise.reject(refreshError);
    }
  }
);

export default httpClient;
