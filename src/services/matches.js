import api, { unwrap } from "./api";

const qs = (params) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : "";
};

export const getMatch = async (id, { filter } = {}) => {
  const query = qs({ filter });
  return unwrap(api(`/matches/${id}${query}`));
};

export const createMatch = (match) =>
  unwrap(
    api(`/matches`, {
      method: "POST",
      body: JSON.stringify(match),
    })
  );

export const listMatches = (
  filter,
  {
    status,
    search = "",
    page = 1,
    perPage = 10,
    latitude,
    longitude,
    distance,
    radius,
  } = {},
) => {
  const params = { page, perPage };
  if (filter) params.filter = filter;
  if (status) params.status = status;
  if (search) params.search = search;
  const addNumericParam = (key, value) => {
    if (value === undefined || value === null) return;
    const numeric =
      typeof value === "string" ? Number.parseFloat(value) : value;
    if (Number.isFinite(numeric)) {
      params[key] = numeric;
    }
  };
  addNumericParam("latitude", latitude);
  addNumericParam("longitude", longitude);
  addNumericParam("distance", distance);
  if (!Object.prototype.hasOwnProperty.call(params, "distance")) {
    addNumericParam("radius", radius);
  }
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
      authSchemePreference: "token",
      json: { match_id: id },
    })
  );

export const leaveMatch = (id) =>
  unwrap(
    api(`/matches/${id}/leave`, {
      method: "POST",
      authSchemePreference: "token",
      json: { match_id: id },
    })
  );

export const removeParticipant = (matchId, playerId) =>
  unwrap(
    api(`/matches/${matchId}/participants/${playerId}`, {
      method: "DELETE",
    })
  );

export const sendInvites = (matchId, { playerIds = [], phoneNumbers = [] } = {}) =>
  unwrap(
    api(`/matches/${matchId}/invites`, {
      method: "POST",
      body: JSON.stringify({ playerIds, phoneNumbers }),
    })
  );

export const getShareLink = (matchId) =>
  unwrap(api(`/matches/${matchId}/share-link`));

export const searchPlayers = ({ search = "", page = 1, perPage = 12, ids } = {}) => {
  const params = { search, page, perPage };
  if (ids && ids.length) params.ids = ids.join(",");
  return unwrap(api(`/matches/players${qs(params)}`));
};
