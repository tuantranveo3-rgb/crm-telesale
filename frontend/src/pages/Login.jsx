import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (email) => setForm({ email, password: '123456' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CRM System</h1>
          <p className="text-gray-500 text-sm mt-1">Quản lý khách hàng & telesales</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="Nhập email..."
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Mật khẩu</label>
            <input
              type="password"
              className="input"
              placeholder="Nhập mật khẩu..."
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-base">
            {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🔑 Đăng nhập'}
          </button>
        </form>

        {/* Quick login for demo */}
        <div className="mt-6 border-t border-gray-100 pt-5">
          <p className="text-xs text-gray-500 text-center mb-3">Tài khoản demo (mật khẩu: 123456)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '👑 Admin', email: 'admin@crm.com' },
              { label: '🗂️ Manager', email: 'manager1@crm.com' },
              { label: '💼 Sale', email: 'sale1@crm.com' },
              { label: '📞 Telesale', email: 'sale3@crm.com' },
            ].map(({ label, email }) => (
              <button key={email} onClick={() => quickLogin(email)}
                className="text-xs px-3 py-2 bg-gray-50 hover:bg-primary-50 text-gray-600 hover:text-primary-700 border border-gray-200 hover:border-primary-300 rounded-lg transition-colors text-center">
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
