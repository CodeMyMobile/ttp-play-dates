import apiClient from './api';

export const login = async (email, password) => {
  const { data } = await apiClient.post('/auth/login', { email, password });
  if (data?.access_token) {
    localStorage.setItem('authToken', data.access_token);
  }
  return data;
};

export const signup = async (email, password) => {
  const { data } = await apiClient.post('/auth/signup', { email, password, user_type: 2 });
  if (data?.access_token) {
    localStorage.setItem('authToken', data.access_token);
  }
  return data;
};

export const getPersonalDetails = async () => {
  const { data } = await apiClient.get('/player/personal_details');
  return data;
};

export const updatePersonalDetails = async (details) => {
  const { data } = await apiClient.post('/player/personal_details', details);
  return data;
};

export const logout = () => {
  localStorage.removeItem('authToken');
};
