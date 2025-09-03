import apiClient from './api';

export const login = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data;
};

export const register = async (data) => {
  const response = await apiClient.post('/auth/register', data);
  return response.data;
};
