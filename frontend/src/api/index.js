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
  customers: (params) => api.get('/reports/customers', { params }),
  calls: (params) => api.get('/reports/calls', { params }),
  followups: () => api.get('/reports/followups'),
  pipeline: () => api.get('/reports/pipeline'),
  exportExcel: (type) => downloadBlob(`${BASE_URL}/reports/export/${type}`, `report_${type}.xlsx`),
};
