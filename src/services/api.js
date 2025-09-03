import axios from 'axios';

// Replace with your actual backend URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add the auth token to every request if it exists
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken'); // Or wherever you store your token
    if (token) {
      // Include auth token header for API authentication
      config.headers.Authorization = `Bearer ${token}`;
      config.headers.authtoken = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
