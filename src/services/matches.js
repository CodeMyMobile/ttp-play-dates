import apiClient from './api';

export const createMatch = async (match) => {
  const { data } = await apiClient.post('/matches', match);
  return data;
};

export const listMatches = async (filter) => {
  const { data } = await apiClient.get('/matches', { params: filter ? { filter } : {} });
  return data;
};

export const updateMatch = async (id, updates) => {
  const { data } = await apiClient.put(`/matches/${id}`, updates);
  return data;
};

export const cancelMatch = async (id) => {
  const { data } = await apiClient.delete(`/matches/${id}`);
  return data;
};

export const joinMatch = async (id) => {
  const { data } = await apiClient.post(`/matches/${id}/join`);
  return data;
};

export const leaveMatch = async (id) => {
  const { data } = await apiClient.post(`/matches/${id}/leave`);
  return data;
};

export const sendInvites = async (matchId, userIds) => {
  // Backend expects an array of user IDs under the key "playerIds"
  const { data } = await apiClient.post(`/matches/${matchId}/invites`, {
    playerIds: userIds,
  });
  return data;
};

export const getShareLink = async (matchId) => {
  const { data } = await apiClient.get(`/matches/${matchId}/share-link`);
  return data;
};

export const searchPlayers = async (
  { search = '', page = 1, perPage = 12 } = {}
) => {
  const { data } = await apiClient.get('/matches/players', {
    params: { search, page, perPage },
  });
  return data;
};

