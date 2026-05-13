import axios from 'axios';
import { logError } from '../services/logger';

const normalizeUrl = (value) => {
  if (!value) {
    return '';
  }

  return String(value).trim().replace(/\/+$/, '');
};

const resolveApiBaseUrl = () => {
  const envUrl = normalizeUrl(import.meta.env.VITE_API_URL);
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return '/api/v1';
    }

    return `${window.location.origin.replace(/\/+$/, '')}/api/v1`;
  }

  return 'http://127.0.0.1:8000/api/v1';
};

const API_BASE_URL = resolveApiBaseUrl();
const MAX_RETRIES = 2;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  const setHeader = (key, value) => {
    if (typeof config.headers.set === 'function') {
      config.headers.set(key, value);
      return;
    }

    config.headers[key] = value;
  };

  const token = localStorage.getItem('auth_token');
  if (token) {
    setHeader('Authorization', `Bearer ${token}`);
  }

  if (!(typeof config.headers.get === 'function' ? config.headers.get('X-Request-ID') : config.headers['X-Request-ID'])) {
    const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setHeader('X-Request-ID', requestId);
    config.metadata = { ...(config.metadata || {}), requestId };
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      logError('API request failed without config', error);
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const method = String(originalRequest?.method || 'get').toLowerCase();
    const shouldRetry = (!status || status >= 500) && ['get', 'head'].includes(method);

    if (shouldRetry) {
      originalRequest.__retryCount = originalRequest.__retryCount || 0;

      if (originalRequest.__retryCount < MAX_RETRIES) {
        originalRequest.__retryCount += 1;
        const delay = 250 * (2 ** (originalRequest.__retryCount - 1));
        await new Promise((resolve) => setTimeout(resolve, delay));
        return apiClient(originalRequest);
      }
    }

    logError('API request failed', error, {
      url: originalRequest?.url,
      method,
      status,
    });

    return Promise.reject(error);
  }
);

export default apiClient;
