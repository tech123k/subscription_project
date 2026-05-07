import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401, refresh token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken } = res.data.data;
        useAuthStore.getState().setAccessToken(accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const message = error.response?.data?.message || error.message || 'Something went wrong';

    if (error.response?.status !== 401 && error.response?.status !== 403) {
      toast.error(message);
    }

    return Promise.reject(error.response?.data || error);
  }
);

// Typed API modules
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const dashboardAPI = {
  getStats: (period) => api.get('/dashboard/stats', { params: { period } }),
  getCharts: (period) => api.get('/dashboard/charts', { params: { period } }),
  getWarehouseStock: () => api.get('/dashboard/warehouse-stock'),
  getProductionTimeline: () => api.get('/dashboard/production-timeline'),
  getLowStock: () => api.get('/dashboard/low-stock'),
};

export const materialAPI = {
  getAll: (params) => api.get('/materials', { params }),
  getById: (id) => api.get(`/materials/${id}`),
  getOne: (id) => api.get(`/materials/${id}`),
  create: (data) => api.post('/materials', data),
  update: (id, data) => api.put(`/materials/${id}`, data),
  delete: (id) => api.delete(`/materials/${id}`),
  adjustStock: (id, data) => api.patch(`/materials/${id}/stock`, data),
  getTransactions: (id, params) => api.get(`/materials/${id}/transactions`, { params }),
  getHistory: (id, params) => api.get(`/materials/${id}/history`, { params }),
  createGRN: (data) => api.post('/materials/grn', data),
  getCategories: () => api.get('/materials/categories'),
  createCategory: (data) => api.post('/materials/categories', data),
  export: () => `${API_URL}/materials/export`,
  template: () => `${API_URL}/materials/template`,
};

export const productionAPI = {
  getAll: (params) => api.get('/production', { params }),
  getById: (id) => api.get(`/production/${id}`),
  getOne: (id) => api.get(`/production/${id}`),
  create: (data) => api.post('/production', data),
  updateStage: (id, data) => api.put(`/production/${id}/stage`, data),
  updateStatus: (id, data) => api.patch(`/production/${id}/status`, data),
  export: () => `${API_URL}/production/export`,
};

export const workflowAPI = {
  getTemplates: () => api.get('/workflows'),
  getTemplate: (id) => api.get(`/workflows/${id}`),
  createTemplate: (data) => api.post('/workflows', data),
  updateTemplate: (id, data) => api.put(`/workflows/${id}`, data),
  addStage: (templateId, data) => api.post(`/workflows/${templateId}/stages`, data),
  updateStage: (stageId, data) => api.put(`/workflows/stages/${stageId}`, data),
  reorderStages: (templateId, data) => api.patch(`/workflows/${templateId}/stages/reorder`, data),
  deleteStage: (stageId) => api.delete(`/workflows/stages/${stageId}`),
};

export const dispatchAPI = {
  getAll: (params) => api.get('/dispatches', { params }),
  getById: (id) => api.get(`/dispatches/${id}`),
  getOne: (id) => api.get(`/dispatches/${id}`),
  create: (data) => api.post('/dispatches', data),
  updateStatus: (id, data) => api.patch(`/dispatches/${id}/status`, data),
  export: () => `${API_URL}/dispatches/export`,
};

export const invoiceAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  getOne: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  getPDF: (id) => `${API_URL}/invoices/${id}/pdf`,
  addPayment: (id, data) => api.post(`/invoices/${id}/payments`, data),
  updatePayment: (id, data) => api.patch(`/invoices/${id}/payment`, data),
  export: () => `${API_URL}/invoices/export`,
};

export const warehouseAPI = {
  getAll: (params) => api.get('/warehouses', { params }),
  getById: (id) => api.get(`/warehouses/${id}`),
  getOne: (id) => api.get(`/warehouses/${id}`),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  delete: (id) => api.delete(`/warehouses/${id}`),
  createTransfer: (data) => api.post('/warehouses/transfers', data),
  getTransfers: (params) => api.get('/warehouses/transfers', { params }),
  addRack: (id, data) => api.post(`/warehouses/${id}/racks`, data),
};

export const supplierAPI = {
  getAll: (params) => api.get('/suppliers', { params }),
  getOne: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

export const customerAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getOne: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, data) => api.patch(`/users/${id}/reset-password`, data),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const companyAPI = {
  getAll: (params) => api.get('/companies', { params }),
  getOne: (id) => api.get(`/companies/${id}`),
  update: (id, data) => api.put(`/companies/${id}`, data),
  toggleStatus: (id) => api.patch(`/companies/${id}/toggle-status`),
  updateSubscription: (id, data) => api.patch(`/companies/${id}/subscription`, data),
  getSettings: () => api.get('/companies/settings'),
  updateSettings: (data) => api.put('/companies/settings', data),
};

export const grnAPI = {
  getAll: (params) => api.get('/grn', { params }),
  getById: (id) => api.get(`/grn/${id}`),
  create: (data) => api.post('/grn', data),
  update: (id, data) => api.put(`/grn/${id}`, data),
};

export const superAdminAPI = {
  getCompanies: (params) => api.get('/companies', { params }),
  toggleCompany: (id, data) => api.patch(`/companies/${id}/toggle-status`, data),
  extendSubscription: (id, data) => api.patch(`/companies/${id}/subscription`, data),
  getDashboard: () => api.get('/dashboard/stats'),
};

export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/mark-all-read'),
};

export const reportAPI = {
  stock: (params) => api.get('/reports/stock', { params }),
  production: (params) => api.get('/reports/production', { params }),
  financial: (params) => api.get('/reports/financial', { params }),
  dispatch: (params) => api.get('/reports/dispatch', { params }),
  stockTransactions: (params) => api.get('/reports/stock-transactions', { params }),
  audit: (params) => api.get('/reports/audit', { params }),
};

export const auditAPI = {
  getAll: (params) => api.get('/audit', { params }),
};

export default api;
