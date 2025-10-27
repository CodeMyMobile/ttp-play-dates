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

const pickArray = (...candidates) => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

const pickObject = (...candidates) => {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      continue;
    }
    return candidate;
  }
  return {};
};

const normalizePagination = (data) => {
  const explicit = pickObject(
    data?.pagination,
    data?.meta?.pagination,
    data?.meta?.page_info,
    data?.meta?.pageInfo,
  );
  if (explicit && Object.keys(explicit).length > 0) {
    return explicit;
  }

  const parseNumeric = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const numeric =
        typeof value === "string" ? Number.parseFloat(value) : Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
    return null;
  };

  const page = parseNumeric(
    data?.page,
    data?.current_page,
    data?.meta?.page,
    data?.meta?.current_page,
    data?.meta?.pageNumber,
  );
  const perPage = parseNumeric(
    data?.perPage,
    data?.per_page,
    data?.page_size,
    data?.meta?.perPage,
    data?.meta?.per_page,
    data?.meta?.page_size,
    data?.meta?.pageSize,
  );
  const total = parseNumeric(
    data?.total,
    data?.count,
    data?.meta?.total,
    data?.meta?.total_count,
    data?.meta?.count,
  );

  if (!Number.isFinite(perPage) || perPage <= 0) {
    return null;
  }

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    perPage,
    ...(Number.isFinite(total) && total >= 0 ? { total } : {}),
  };
};

const normalizeMatchesResponse = (data) => {
  const matches = pickArray(
    data?.matches,
    data?.data,
    data?.items,
    data?.results,
    Array.isArray(data) ? data : null,
  );

  const counts = pickObject(
    data?.counts,
    data?.summary,
    data?.meta?.counts,
    data?.meta?.summary,
  );

  const base = data && typeof data === "object" && !Array.isArray(data) ? data : {};

  return {
    ...base,
    matches,
    counts,
    pagination: normalizePagination(base) || null,
  };
};

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
  return unwrap(api(`/matches${qs(params)}`)).then(normalizeMatchesResponse);
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
