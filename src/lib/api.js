// Support both VITE_API_URL (preferred) and legacy VITE_API_BASE_URL
const API =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "";

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.status !== 204 ? res.json() : null;
}

export const Invites = {
  getPreview: (token) => api(`/invites/${token}`),
  begin: (token, payload) => api(`/invites/${token}/begin`, { method: "POST", body: payload }),
  verify: (token, code) => api(`/invites/${token}/verify`, { method: "POST", body: { code } }),
};

export const Matches = { get: (id) => api(`/matches/${id}`) };
