import axios from 'axios';

// Khi dev: proxy qua vite → localhost:5000/api
// Khi production: dùng VITE_API_URL từ Vercel env
const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const api = axios.create({ baseURL: BASE_URL, timeout: 60000 });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('crm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || { message: 'Lỗi kết nối' });
  }
);

// Helper: download file với auth header (fix cho production)
async function downloadBlob(url, filename) {
  const token = localStorage.getItem('crm_token');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Download thất bại');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export default api;

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const usersApi = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const areasApi = {
  list: () => api.get('/areas'),
  get: (id) => api.get(`/areas/${id}`),
  create: (data) => api.post('/areas', data),
  update: (id, data) => api.put(`/areas/${id}`, data),
  delete: (id) => api.delete(`/areas/${id}`),
};

export const customersApi = {
  list: (params) => api.get('/customers', { params }),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  bulkDelete: (ids) => api.post('/customers/bulk-delete', { ids }),
  exportExcel: () => downloadBlob(`${BASE_URL}/customers/export/excel`, 'customers.xlsx'),
  downloadTemplate: () => downloadBlob(`${BASE_URL}/customers/import/template`, 'import_template.xlsx'),
  importExcel: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/customers/import/excel', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },
};

export const callLogsApi = {
  list: (params) => api.get('/call-logs', { params }),
  create: (data) => api.post('/call-logs', data),
  update: (id, data) => api.put(`/call-logs/${id}`, data),
  delete: (id) => api.delete(`/call-logs/${id}`),
};

export const followUpsApi = {
  list: (params) => api.get('/follow-ups', { params }),
  create: (data) => api.post('/follow-ups', data),
  update: (id, data) => api.put(`/follow-ups/${id}`, data),
  delete: (id) => api.delete(`/follow-ups/${id}`),
};

export const pipelineApi = {
  list: (params) => api.get('/pipeline', { params }),
  create: (data) => api.post('/pipeline', data),
  update: (id, data) => api.put(`/pipeline/${id}`, data),
  delete: (id) => api.delete(`/pipeline/${id}`),
};

export const dashboardApi = {
  get: (params) => api.get('/dashboard', { params }),
};

export const reportsApi = {
  overview: (params) => api.get('/reports/overview', { params }),
  callDetails: (params) => api.get('/reports/call-details', { params }),
  salePerformance: (params) => api.get('/reports/sale-performance', { params }),
  callsByCustomer: (params) => api.get('/reports/calls-by-customer', { params }),
  followups: (params) => api.get('/reports/followups', { params }),
  pipeline: () => api.get('/reports/pipeline'),
  customers: (params) => api.get('/reports/customers', { params }),
  exportExcel: (type, params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return downloadBlob(`${BASE_URL}/reports/export/${type}${qs}`, `report_${type}.xlsx`);
  },
};

export const settingsApi = {
  getLookups: () => api.get('/settings/lookups/all'),
  getLookupsPublic: () => api.get('/settings/lookups'),
  createLookup: (data) => api.post('/settings/lookups', data),
  updateLookup: (id, data) => api.put(`/settings/lookups/${id}`, data),
  deleteLookup: (id) => api.delete(`/settings/lookups/${id}`),
};
