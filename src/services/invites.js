import apiClient from './api';

export const listInvites = async ({ status, page, perPage } = {}) => {
  const params = {};
  if (status) params.status = status;
  if (page) params.page = page;
  if (perPage) params.perPage = perPage;
  const { data } = await apiClient.get('/invites', { params });
  return data;
};

export const acceptInvite = async (token) => {
  const { data } = await apiClient.post('/invites/accept', { token });
  return data;
};

export const rejectInvite = async (token) => {
  const { data } = await apiClient.post('/invites/reject', { token });
  return data;
};
