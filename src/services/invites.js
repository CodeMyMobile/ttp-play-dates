import api, { unwrap } from "./api";

export const getInvitePreview = (token) =>
  unwrap(api(`/invites/${token}`));

export const beginInviteVerification = (token, payload) =>
  unwrap(
    api(`/invites/${token}/begin`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    })
  );

export const verifyInviteCode = (token, code) =>
  unwrap(
    api(`/invites/${token}/verify`, {
      method: "POST",
      body: JSON.stringify({ code }),
    })
  );

export const listInvites = ({ status, page, perPage } = {}) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page) params.set("page", page);
  if (perPage) params.set("perPage", perPage);
  const qs = params.toString();
  return unwrap(api(`/invites${qs ? `?${qs}` : ""}`));
};

export const acceptInvite = (token) =>
  unwrap(
    api(`/invites/accept`, {
      method: "POST",
      body: JSON.stringify({ token }),
    })
  );

export const rejectInvite = (token) =>
  unwrap(
    api(`/invites/reject`, {
      method: "POST",
      body: JSON.stringify({ token }),
    })
  );

export const getInviteByToken = (token) => unwrap(api(`/invites/${token}`));
