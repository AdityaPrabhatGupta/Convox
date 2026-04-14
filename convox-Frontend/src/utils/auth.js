const isBrowser = typeof window !== "undefined";

const clearStoredAuth = () => {
  if (!isBrowser) return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

const decodeJwtPayload = (token) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

export const getToken = () => {
  if (!isBrowser) return null;

  const token = localStorage.getItem("token");
  if (!token || token === "undefined" || token === "null") return null;

  const payload = decodeJwtPayload(token);
  if (!payload) {
    clearStoredAuth();
    return null;
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    clearStoredAuth();
    return null;
  }

  return token;
};

export const isLoggedIn = () => !!getToken();

export const getCurrentUserId = () => {
  const token = getToken();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  // Fix: use != null instead of truthy check so id=0 is not incorrectly treated as missing
  return payload?.id != null ? String(payload.id) : null;
};

export const saveToken = (token) => {
  if (!isBrowser) return;
  localStorage.setItem("token", token);
};

export const logout = () => {
  clearStoredAuth();
};