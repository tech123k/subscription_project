import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// 90s timeout — covers Render free-tier cold starts (typically 30-60s)
const api = axios.create({
  baseURL: API_URL,
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach token + mark request start time
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    config._startTime = Date.now();
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401, refresh token, timeout, network errors
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

const isTimeoutError = (error) =>
  error.code === 'ECONNABORTED' ||
  error.code === 'ERR_NETWORK' ||
  error.message?.toLowerCase().includes('timeout') ||
  error.message?.toLowerCase().includes('network error');

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;

    // ── Token refresh on 401 ──────────────────────────────────
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
        isRefreshing = false;
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

    // ── Timeout / network-down handling ──────────────────────
    if (isTimeoutError(error)) {
      // Only show toast if not already retrying
      if (!original._timeoutRetry) {
        toast.error(
          'Server is taking longer than usual. Please wait a moment and try again.',
          { id: 'timeout-toast', duration: 6000 }
        );
      }
      return Promise.reject({
        status: 0,
        message: 'Server is taking longer than usual. Please wait a moment and try again.',
        isTimeout: true,
      });
    }

    // ── No internet connection ────────────────────────────────
    if (!navigator.onLine) {
      toast.error('No internet connection. Please check your network.', {
        id: 'offline-toast',
        duration: 5000,
      });
      return Promise.reject({
        status: 0,
        message: 'No internet connection.',
        isOffline: true,
      });
    }

    const message = error.response?.data?.message || error.message || 'Something went wrong';
    const status = error.response?.status;

    // Skip auto-toast for codes that forms handle themselves
    const silentCodes = new Set([400, 401, 403, 409, 422]);
    if (!silentCodes.has(status)) {
      toast.error(message);
    }

    return Promise.reject({ ...(error.response?.data || {}), status, message, response: error.response });
  }
);

// Typed API modules
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  sendOtp: (data) => api.post('/auth/send-otp', data),
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
  export: () => api.get('/materials/export', { responseType: 'blob' }),
  template: () => api.get('/materials/template', { responseType: 'blob' }),
  import: (formData) => api.post('/materials/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const productAPI = {
  getAll:           (params) => api.get('/products', { params }),
  getOne:           (id)     => api.get(`/products/${id}`),
  create:           (data)   => api.post('/products', data),
  update:           (id, data) => api.put(`/products/${id}`, data),
  delete:           (id)     => api.delete(`/products/${id}`),
  getCategories:    ()       => api.get('/products/categories'),
  getBOMForQuantity:(id, qty)=> api.get(`/products/${id}/bom-calculate`, { params: { qty } }),
  getSummary:       ()       => api.get('/products/summary'),
  getHistory:       (id)     => api.get(`/products/${id}/history`),
  getAnalytics:     ()       => api.get('/products/analytics'),
};

export const bomAPI = {
  getByProduct: (productId) => api.get(`/bom/products/${productId}`),
  upsert: (productId, data) => api.post(`/bom/products/${productId}`, data),
  addItem: (productId, data) => api.post(`/bom/products/${productId}/items`, data),
  updateItem: (itemId, data) => api.put(`/bom/items/${itemId}`, data),
  removeItem: (itemId) => api.delete(`/bom/items/${itemId}`),
};

export const productionAPI = {
  getAll: (params) => api.get('/production', { params }),
  getById: (id) => api.get(`/production/${id}`),
  getOne: (id) => api.get(`/production/${id}`),
  create: (data) => api.post('/production', data),
  updateStage: (id, data) => api.put(`/production/${id}/stage`, data),
  revertStage: (id, data) => api.post(`/production/${id}/revert-stage`, data),
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
  delete: (id) => api.delete(`/grn/${id}`),
};

export const poAPI = {
  getAll: (params) => api.get('/po', { params }),
  getById: (id) => api.get(`/po/${id}`),
  create: (data) => api.post('/po', data),
  update: (id, data) => api.put(`/po/${id}`, data),
  updateStatus: (id, status) => api.patch(`/po/${id}/status`, { status }),
  delete: (id) => api.delete(`/po/${id}`),
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

// ─── VARIANT ENGINE ───────────────────────────────────────────────────────────
export const variantAPI = {
  getAttributes:          ()          => api.get('/variants/attributes'),
  createAttribute:        (data)      => api.post('/variants/attributes', data),
  updateAttribute:        (id, data)  => api.put(`/variants/attributes/${id}`, data),
  addAttributeValue:      (id, data)  => api.post(`/variants/attributes/${id}/values`, data),
  updateAttributeValue:   (id, data)  => api.put(`/variants/attributes/values/${id}`, data),
  deleteAttributeValue:   (id)        => api.delete(`/variants/attributes/values/${id}`),
  generateCombinations:   (data)      => api.post('/variants/generate-combinations', data),
  getVariants:            (productId, params) => api.get(`/variants/products/${productId}/variants`, { params }),
  createVariants:         (productId, data)   => api.post(`/variants/products/${productId}/variants`, data),
  updateVariant:          (variantId, data)   => api.put(`/variants/variants/${variantId}`, data),
  deleteVariant:          (variantId)         => api.delete(`/variants/variants/${variantId}`),
  adjustVariantStock:     (variantId, data)   => api.post(`/variants/variants/${variantId}/adjust-stock`, data),
  getBomOverrides:        (productId, variantId) => api.get(`/variants/products/${productId}/variants/${variantId}/bom-overrides`),
  upsertBomOverride:      (productId, variantId, data) => api.post(`/variants/products/${productId}/variants/${variantId}/bom-overrides`, data),
};

// ─── INVENTORY LEDGER ─────────────────────────────────────────────────────────
export const ledgerAPI = {
  getEntries:           (params)     => api.get('/ledger', { params }),
  getLowStock:          ()           => api.get('/ledger/low-stock'),
  getMovementSummary:   (params)     => api.get('/ledger/movement-summary', { params }),
  adjust:               (data)       => api.post('/ledger/adjust', data),
  getMaterialCard:      (materialId, params) => api.get(`/ledger/materials/${materialId}`, { params }),
  getProductCard:       (productId, params)  => api.get(`/ledger/products/${productId}`, { params }),
};

// ─── SALES ORDERS (OMS) ───────────────────────────────────────────────────────
export const salesOrderAPI = {
  getAll:           (params)  => api.get('/sales-orders', { params }),
  getSummary:       ()        => api.get('/sales-orders/summary'),
  getOne:           (id)      => api.get(`/sales-orders/${id}`),
  create:           (data)    => api.post('/sales-orders', data),
  updateStatus:     (id, data)=> api.patch(`/sales-orders/${id}/status`, data),
  createBackorder:  (id)      => api.post(`/sales-orders/${id}/backorder`),
  delete:           (id)      => api.delete(`/sales-orders/${id}`),
};

// ─── CREDIT & OUTSTANDING ─────────────────────────────────────────────────────
export const creditAPI = {
  getOutstandingList:     (params)               => api.get('/credit/outstanding', { params }),
  getCustomerCredit:      (customerId)            => api.get(`/credit/customers/${customerId}`),
  updateCreditSettings:   (customerId, data)      => api.put(`/credit/customers/${customerId}/settings`, data),
  recordPayment:          (customerId, data)      => api.post(`/credit/customers/${customerId}/payment`, data),
  addInvoiceTransaction:  (customerId, data)      => api.post(`/credit/customers/${customerId}/transaction`, data),
};

export default api;
