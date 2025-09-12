const baseURL = import.meta.env.VITE_API_URL || "https://ttp-api.codemymobile.com/api";

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
      throw new Error(msg);
    }
    return data;
  });

export default api;
