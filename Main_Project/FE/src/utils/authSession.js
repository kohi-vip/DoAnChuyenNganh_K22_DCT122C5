export const STORAGE_AUTH_SESSION_KEY = "pfm_auth_session";
export const STORAGE_AUTH_USER_KEY = "pfm_auth_user";
export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{9,}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseJSON = (raw) => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const isPasswordValid = (password) => PASSWORD_PATTERN.test(password || "");

export const isEmailValid = (email) => EMAIL_PATTERN.test((email || "").trim());

export const getAuthSession = () => {
  const session = parseJSON(localStorage.getItem(STORAGE_AUTH_SESSION_KEY));
  if (!session) {
    return null;
  }

  if (!session.expires_at || session.expires_at <= Date.now()) {
    localStorage.removeItem(STORAGE_AUTH_SESSION_KEY);
    localStorage.removeItem(STORAGE_AUTH_USER_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return null;
  }

  return session;
};

export const setAuthSession = ({ user, accessToken, refreshToken, expiresInSeconds = 3600 }) => {
  const expiresAt = Date.now() + Math.max(1, Number(expiresInSeconds)) * 1000;
  const session = {
    user,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  };

  localStorage.setItem(STORAGE_AUTH_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(STORAGE_AUTH_USER_KEY, JSON.stringify(user || null));
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

  return session;
};

export const clearAuthSession = () => {
  localStorage.removeItem(STORAGE_AUTH_SESSION_KEY);
  localStorage.removeItem(STORAGE_AUTH_USER_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const getCurrentUser = () => getAuthSession()?.user || null;

export const clearCurrentUser = () => {
  clearAuthSession();
};
