import { resolveApiBaseUrl } from "./config.js";

const baseURL = resolveApiBaseUrl();

const api = (path, options = {}) => {
  const token = localStorage.getItem("authToken");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Allow absolute URLs by not prefixing baseURL when path looks absolute
  const url = /^https?:\/\//i.test(path) ? path : baseURL + path;
  // Default to no cookies to avoid CORS credential restrictions unless explicitly requested
  const credentials = options.credentials ?? "omit";
  return fetch(url, {
    ...options,
    credentials,
    headers,
  });
};

export const unwrap = (p) =>
  p.then(async (r) => {
    let data = null;
    try {
      data = await r.json();
    } catch {
      // ignore non-JSON responses
    }
    if (!r.ok) {
      const msg = data?.error || r.statusText || "API_ERROR";
      const error = new Error(msg);
      error.status = r.status;
      error.data = data;
      error.response = {
        data,
        status: r.status,
        statusText: r.statusText,
      };
      throw error;
    }
    return data;
  });

export default api;
