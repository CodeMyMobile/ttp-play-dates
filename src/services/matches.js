import api, { unwrap } from "./api";

const qs = (params) => {
  const search = new URLSearchParams(params);
  const str = search.toString();
  return str ? `?${str}` : "";
};

export const getMatch = async (id) => unwrap(api(`/matches/${id}`));

export const createMatch = (match) =>
  unwrap(
    api(`/matches`, {
      method: "POST",
      body: JSON.stringify(match),
    })
  );

export const listMatches = (
  filter,
  { status, search = "", page = 1, perPage = 10 } = {}
) => {
  const params = { page, perPage };
  if (filter) params.filter = filter;
  if (status) params.status = status;
  if (search) params.search = search;
  return unwrap(api(`/matches${qs(params)}`));
};

export const updateMatch = (id, updates) =>
  unwrap(
    api(`/matches/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  );

export const cancelMatch = (id) =>
  unwrap(
    api(`/matches/${id}`, {
      method: "DELETE",
    })
  );

export const joinMatch = (id) =>
  unwrap(
    api(`/matches/${id}/join`, {
      method: "POST",
    })
  );

export const leaveMatch = (id) =>
  unwrap(
    api(`/matches/${id}/leave`, {
      method: "POST",
    })
  );

export const sendInvites = (matchId, userIds) =>
  unwrap(
    api(`/matches/${matchId}/invites`, {
      method: "POST",
      body: JSON.stringify({ playerIds: userIds }),
    })
  );

export const getShareLink = (matchId) =>
  unwrap(api(`/matches/${matchId}/share-link`));

export const searchPlayers = ({ search = "", page = 1, perPage = 12, ids } = {}) => {
  const params = { search, page, perPage };
  if (ids && ids.length) params.ids = ids.join(",");
  return unwrap(api(`/matches/players${qs(params)}`));
};
