import axios from "axios";
import { getToken, logout, refreshAccessToken } from "../utils/auth.js";

const rawApiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const apiBaseUrl = rawApiBaseUrl.replace(/\/+$/, "").replace(/\/api$/, "");

const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axios.defaults.withCredentials = true;

let refreshPromise = null;

// Request Interceptor
// Runs BEFORE every request is sent
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken(); // uses expiry-aware getToken() instead of raw localStorage

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
// Runs AFTER every response arrives
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestUrl = error.config?.url || "";
    const originalRequest = error.config || {};
    const isAuthRequest =
      requestUrl.includes("/api/users/login") ||
      requestUrl.includes("/api/users/register") ||
      requestUrl.includes("/api/users/refresh");

    if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      refreshPromise ||= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });

      const refreshed = await refreshPromise;
      if (refreshed) {
        const nextToken = getToken();
        if (nextToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        }
        return axiosInstance(originalRequest);
      }
    }

    if (error.response?.status === 401 && !isAuthRequest) {
      logout();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
