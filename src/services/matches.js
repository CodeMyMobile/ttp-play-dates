import api, { unwrap } from "./api";

export const getMatch = (id) =>
  unwrap(api.get(`/matches/${id}`));

export const createMatch = async (match) => {
  const { data } = await api.post('/matches', match);
  return data;
};

export const listMatches = async (
  filter,
  { status, search = '', page = 1, perPage = 10 } = {}
) => {
  const params = { page, perPage };
  if (filter) params.filter = filter;
  if (status) params.status = status;
  if (search) params.search = search;
  const { data } = await api.get('/matches', { params });
  return data;
};

export const updateMatch = async (id, updates) => {
  const { data } = await api.put(`/matches/${id}`, updates);
  return data;
};

export const cancelMatch = async (id) => {
  const { data } = await api.delete(`/matches/${id}`);
  return data;
};

export const joinMatch = async (id) => {
  const { data } = await api.post(`/matches/${id}/join`);
  return data;
};

export const leaveMatch = async (id) => {
  const { data } = await api.post(`/matches/${id}/leave`);
  return data;
};

export const sendInvites = async (matchId, userIds) => {
  const { data } = await api.post(`/matches/${matchId}/invites`, {
    playerIds: userIds,
  });
  return data;
};

export const getShareLink = async (matchId) => {
  const { data } = await api.get(`/matches/${matchId}/share-link`);
  return data;
};

export const searchPlayers = async (
  { search = '', page = 1, perPage = 12, ids } = {}
) => {
  const params = { search, page, perPage };
  if (ids && ids.length) params.ids = ids.join(',');
  const { data } = await api.get('/matches/players', { params });
  return data;
};
