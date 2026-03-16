// Axios API client for QuantumTrader Dashboard
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle responses and errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication APIs
export const authAPI = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),
  logout: () =>
    api.post('/api/auth/logout'),
  verify: (token) =>
    api.get('/api/auth/verify', { params: { token } }),
};

// Trade APIs
export const tradesAPI = {
  getAllTrades: (limit = 20, offset = 0) =>
    api.get('/api/trades', { params: { limit, offset } }),
  getTradesByDate: (date) =>
    api.get(`/api/trades/date/${date}`),
  getTradesCsvDownloadByDate: (date) =>
    api.get(`/api/trades/date/${date}/download`),
  getTradesByStrategy: (strategy) =>
    api.get(`/api/trades/strategy/${strategy}`),
  filterTrades: (filters) =>
    api.post('/api/trades/filter', filters),
  createTrade: (trade) =>
    api.post('/api/trades', trade),
  deleteTrade: (tradeId, timestamp) =>
    api.delete(`/api/trades/${tradeId}`, { params: { timestamp } }),
};

// Dashboard APIs
export const dashboardAPI = {
  getKPIs: () =>
    api.get('/api/dashboard/kpis'),
  getChartData: () =>
    api.get('/api/dashboard/chart-data'),
  getMonthlyPnL: () =>
    api.get('/api/dashboard/monthly-pnl'),
  getSummary: () =>
    api.get('/api/dashboard/summary'),
};

// Strategy APIs
export const strategyAPI = {
  getStrategies: () =>
    api.get('/api/strategy'),
  getStrategyPerformance: (strategy) =>
    api.get(`/api/strategy/${strategy}/performance`),
  getAllStrategiesPerformance: () =>
    api.get('/api/strategy/all/performance'),
  compareStrategies: () =>
    api.get('/api/strategy/comparison'),
};

// Upload APIs
export const uploadAPI = {
  uploadCSV: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/upload/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getTodayFromS3: () =>
    api.get('/api/s3/today'),
};

export default api;
