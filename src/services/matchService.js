import apiClient from './api';

export const getMatches = async (filter) => {
  const response = await apiClient.get(`/matches?filter=${filter}`);
  return response.data;
};

export const createMatch = async (matchData) => {
  const response = await apiClient.post('/matches', matchData);
  return response.data;
};

export const searchPlayers = async (searchTerm) => {
  const response = await apiClient.get(`/players/search?q=${searchTerm}`);
  return response.data;
};

export const sendInvites = async (matchId, playerIds) => {
  const response = await apiClient.post(`/matches/${matchId}/invites`, { playerIds });
  return response.data;
};
