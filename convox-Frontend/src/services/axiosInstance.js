import axios from "axios";
import { getToken } from "../utils/auth.js";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

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
  (error) => {
    const requestUrl = error.config?.url || "";
    const isAuthRequest =
      requestUrl.includes("/api/users/login") ||
      requestUrl.includes("/api/users/register");

    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;