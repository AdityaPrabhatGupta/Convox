const isBrowser = typeof window !== "undefined";
const rawApiBaseUrl =
  import.meta.env.VITE_API_URL || (isBrowser ? window.location.origin : "http://localhost:5000");
const apiBaseUrl = rawApiBaseUrl.replace(/\/+$/, "").replace(/\/api$/, "");

const clearStoredAuth = () => {
  if (!isBrowser) return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("convox_user");
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
    // Return null to trigger refresh, but DO NOT clear stored auth/user details
    return null;
  }

  return token;
};

export const isLoggedIn = () => !!getToken();

export const getStoredUser = () => {
  if (!isBrowser) return null;
  const userStr = localStorage.getItem("user") || localStorage.getItem("convox_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const getCurrentUserId = () => {
  const user = getStoredUser();
  if (user?._id) return String(user._id);

  const token = localStorage.getItem("token");
  if (!token || token === "undefined" || token === "null") return null;
  const payload = decodeJwtPayload(token);
  return payload?.id != null ? String(payload.id) : null;
};

export const getCurrentUserName = () => {
  const user = getStoredUser();
  if (user?.name) return user.name;

  const token = localStorage.getItem("token");
  if (!token || token === "undefined" || token === "null") return null;
  const payload = decodeJwtPayload(token);
  const name = payload?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
};

export const saveToken = (token) => {
  if (!isBrowser) return;
  localStorage.setItem("token", token);
};

export const saveUser = (user) => {
  if (!isBrowser || !user) return;
  const serialized = JSON.stringify(user);
  localStorage.setItem("user", serialized);
  localStorage.setItem("convox_user", serialized);
};

export const refreshAccessToken = async () => {
  if (!isBrowser) return false;

  try {
    const response = await fetch(`${apiBaseUrl}/api/users/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      clearStoredAuth();
      return false;
    }

    const payload = await response.json();
    if (!payload?.token) {
      clearStoredAuth();
      return false;
    }

    saveToken(payload.token);
    if (payload.data) {
      saveUser(payload.data);
    }

    return true;
  } catch {
    clearStoredAuth();
    return false;
  }
};

export const logout = () => {
  clearStoredAuth();
};
