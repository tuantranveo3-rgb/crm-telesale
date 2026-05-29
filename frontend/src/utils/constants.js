export const CUSTOMER_TYPES = ['C1', 'C2', 'Tiệm nail', 'Spa', 'Salon', 'Đại lý', 'Khách lẻ'];
export const SOURCES = ['DMS', 'Facebook', 'Zalo', 'Telesales', 'Giới thiệu', 'Đi thị trường', 'Khác'];
export const POTENTIAL_LEVELS = ['Cao', 'Trung bình', 'Thấp'];
export const CUSTOMER_STATUSES = ['Khách mới', 'Đã liên hệ', 'Đang chăm sóc', 'Đã mua', 'Ngưng mua', 'Không tiềm năng'];
export const CALL_RESULTS = ['Nghe máy', 'Không nghe', 'Máy bận', 'Hẹn gọi lại', 'Từ chối', 'Quan tâm', 'Chốt đơn'];
export const NEXT_ACTIONS = ['Gửi báo giá', 'Gửi mẫu', 'Hẹn gặp', 'Gọi lại', 'Chốt đơn', 'Không xử lý tiếp'];
export const FOLLOW_UP_TYPES = ['Gọi điện', 'Nhắn Zalo', 'Gặp trực tiếp', 'Gửi báo giá'];
export const FOLLOW_UP_STATUSES = ['Chưa xử lý', 'Đã xử lý', 'Quá hạn', 'Hủy'];
export const PIPELINE_STAGES = ['Lead mới', 'Đã liên hệ', 'Quan tâm', 'Gửi báo giá', 'Đang đàm phán', 'Chốt đơn', 'Mất cơ hội'];
export const ROLES = ['Admin', 'Manager', 'Sale', 'Telesale'];
export const INTEREST_LEVELS = ['Cao', 'Trung bình', 'Thấp'];

export const STATUS_COLORS = {
  'Khách mới': 'badge-blue',
  'Đã liên hệ': 'badge-teal',
  'Đang chăm sóc': 'badge-yellow',
  'Đã mua': 'badge-green',
  'Ngưng mua': 'badge-gray',
  'Không tiềm năng': 'badge-red',
};

export const CALL_RESULT_COLORS = {
  'Nghe máy': 'badge-green',
  'Không nghe': 'badge-red',
  'Máy bận': 'badge-yellow',
  'Hẹn gọi lại': 'badge-blue',
  'Từ chối': 'badge-red',
  'Quan tâm': 'badge-teal',
  'Chốt đơn': 'badge-green',
};

export const FOLLOW_STATUS_COLORS = {
  'Chưa xử lý': 'badge-blue',
  'Đã xử lý': 'badge-green',
  'Quá hạn': 'badge-red',
  'Hủy': 'badge-gray',
};

export const POTENTIAL_COLORS = {
  'Cao': 'badge-green',
  'Trung bình': 'badge-yellow',
  'Thấp': 'badge-red',
};

export const STAGE_COLORS = {
  'Lead mới': 'bg-gray-100 text-gray-700',
  'Đã liên hệ': 'bg-blue-100 text-blue-700',
  'Quan tâm': 'bg-teal-100 text-teal-700',
  'Gửi báo giá': 'bg-yellow-100 text-yellow-700',
  'Đang đàm phán': 'bg-orange-100 text-orange-700',
  'Chốt đơn': 'bg-green-100 text-green-700',
  'Mất cơ hội': 'bg-red-100 text-red-700',
};

export const formatCurrency = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
export const formatDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
export const formatDateTime = (d) => d ? new Date(d).toLocaleString('vi-VN') : '—';
