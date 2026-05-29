# CRM System - Quản lý khách hàng & Telesales

Hệ thống CRM nhỏ gọn cho đội sale/telesales, xây dựng với React + Node.js + SQLite.

## Tính năng

- **Dashboard** — Thống kê cuộc gọi, khách hàng, follow-up, pipeline theo ngày/tháng
- **Khách hàng** — CRUD, tìm kiếm, lọc, import/export Excel
- **Cuộc gọi** — Nhập kết quả nhanh, lịch sử theo khách hàng
- **Follow-up** — Danh sách hôm nay, quá hạn, badge trên menu
- **Pipeline** — Kanban theo giai đoạn bán hàng
- **Báo cáo** — Theo sale/khu vực, export Excel
- **Phân quyền** — Admin / Manager / Sale / Telesale
- **Activity Timeline** — Lịch sử hoạt động theo từng khách hàng

## Yêu cầu

- Node.js >= 18
- npm >= 9

## Cài đặt & Chạy

### 1. Clone / Giải nén dự án

```bash
cd crm-app
```

### 2. Cài đặt & khởi động Backend

```bash
cd backend
npm install

# Copy file môi trường
copy .env.example .env

# Tạo database và seed data mẫu
npm run setup

# Chạy server (development)
npm run dev
```

Backend sẽ chạy tại: `http://localhost:5000`

### 3. Cài đặt & khởi động Frontend

```bash
cd ../frontend
npm install
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:5173`

### 4. Truy cập ứng dụng

Mở trình duyệt: `http://localhost:5173`

## Tài khoản demo

| Vai trò   | Email                | Mật khẩu |
|-----------|----------------------|-----------|
| Admin     | admin@crm.com        | 123456    |
| Manager   | manager1@crm.com     | 123456    |
| Sale      | sale1@crm.com        | 123456    |
| Telesale  | sale3@crm.com        | 123456    |

## Cấu trúc thư mục

```
crm-app/
├── backend/
│   ├── migrations/       # Schema database
│   ├── seeds/            # Dữ liệu mẫu
│   ├── src/
│   │   ├── config/       # Database config
│   │   ├── middleware/   # Auth, roles
│   │   ├── routes/       # API endpoints
│   │   └── utils/        # Helpers
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios API calls
│   │   ├── components/   # Layout, Modal, Pagination...
│   │   ├── context/      # Auth context
│   │   ├── pages/        # Dashboard, Customers, CallLogs...
│   │   └── utils/        # Constants, helpers
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## API Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| POST | /api/auth/login | Đăng nhập |
| GET | /api/auth/me | Thông tin user hiện tại |
| GET | /api/customers | Danh sách khách hàng |
| POST | /api/customers | Thêm khách hàng |
| GET | /api/customers/:id | Chi tiết + timeline |
| GET | /api/customers/export/excel | Export Excel |
| POST | /api/customers/import/excel | Import Excel |
| GET | /api/call-logs | Lịch sử cuộc gọi |
| POST | /api/call-logs | Nhập cuộc gọi mới |
| GET | /api/follow-ups | Danh sách follow-up |
| GET | /api/pipeline | Pipeline theo giai đoạn |
| GET | /api/dashboard | Số liệu dashboard |
| GET | /api/reports/calls | Báo cáo cuộc gọi |
| GET | /api/users | Danh sách users |
| GET | /api/areas | Danh sách khu vực |

## Phân quyền

| Tính năng | Admin | Manager | Sale | Telesale |
|-----------|-------|---------|------|----------|
| Xem tất cả KH | ✅ | Theo KV | Của mình | Của mình |
| Tạo/sửa KH | ✅ | ✅ | ✅ | ✅ |
| Xóa KH | ✅ | ✅ | ❌ | ❌ |
| Quản lý users | ✅ | ❌ | ❌ | ❌ |
| Xem báo cáo | ✅ | Theo KV | ❌ | ❌ |

## Công nghệ sử dụng

**Backend:** Node.js, Express, better-sqlite3, JWT, ExcelJS, Multer, bcryptjs

**Frontend:** React 18, Vite, Tailwind CSS, TanStack Query, React Router, Recharts, react-hot-toast

## Lưu ý

- File database SQLite được lưu tại `backend/crm.db`
- Import Excel tối đa 5MB
- Để chạy production, build frontend: `npm run build` rồi serve thư mục `dist/`
