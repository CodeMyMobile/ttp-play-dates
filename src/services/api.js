import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true, // important for HttpOnly session cookie
  headers: { "Content-Type": "application/json" },
});

// Attach auth token from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Utility to unwrap axios or throw a clean error
export const unwrap = (p) =>
  p.then((r) => r.data).catch((e) => {
    const msg = e?.response?.data?.error || e.message || "API_ERROR";
    throw new Error(msg);
  });

export default api;
