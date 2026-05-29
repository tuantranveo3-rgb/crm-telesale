const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = await getDb();
    const user = await db.get('SELECT user_id, full_name, email, role, area_id, status FROM users WHERE user_id = ?', [decoded.userId]);
    if (!user || user.status !== 'Active') {
      return res.status(401).json({ message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
