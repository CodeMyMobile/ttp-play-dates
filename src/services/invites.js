import api, { unwrap } from "./api";

export const getInvitePreview = (token) =>
  unwrap(api.get(`/invites/${token}`));

export const beginInviteVerification = (token, payload) =>
  unwrap(api.post(`/invites/${token}/begin`, payload || {}));

export const verifyInviteCode = (token, code) =>
  unwrap(api.post(`/invites/${token}/verify`, { code }));

export const listInvites = async ({ status, page, perPage } = {}) => {
  const params = {};
  if (status) params.status = status;
  if (page) params.page = page;
  if (perPage) params.perPage = perPage;
  const { data } = await api.get("/invites", { params });
  return data;
};

export const acceptInvite = async (token) => {
  const { data } = await api.post("/invites/accept", { token });
  return data;
};

export const rejectInvite = async (token) => {
  const { data } = await api.post("/invites/reject", { token });
  return data;
};

export const getInviteByToken = async (token) => {
  const { data } = await api.get(`/invites/${token}`);
  return data;
};
