import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true, // important for HttpOnly session cookie
  headers: { "Content-Type": "application/json" },
});

// Utility to unwrap axios or throw a clean error
export const unwrap = (p) =>
  p.then((r) => r.data).catch((e) => {
    const msg = e?.response?.data?.error || e.message || "API_ERROR";
    throw new Error(msg);
  });

export default api;
