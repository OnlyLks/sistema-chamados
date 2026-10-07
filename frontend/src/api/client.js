// src/api/client.js

import axios from 'axios';

// Em produção a API fica sob /api no mesmo domínio HTTPS do frontend.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    const access_token = sessionStorage.getItem('access_token'); 
    
    if (access_token) {
      config.headers.Authorization = `Bearer ${access_token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const getChatWebSocketUrl = (chamadoId) => {
  const apiUrl = new URL(API_BASE_URL, window.location.origin);
  const protocolo = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = sessionStorage.getItem('access_token');
  const basePath = apiUrl.pathname.replace(/\/$/, '');
  return `${protocolo}//${apiUrl.host}${basePath}/chamados/${chamadoId}/ws?token=${encodeURIComponent(token || '')}`;
};

export default api;
