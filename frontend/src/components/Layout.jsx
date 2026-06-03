import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { followUpsApi } from '../api';

const NAV_ITEMS = [
  { path: '/', icon: '📊', label: 'Dashboard' },
  { path: '/customers', icon: '👥', label: 'Khách hàng' },
  { path: '/call-logs', icon: '📞', label: 'Cuộc gọi' },
  { path: '/follow-ups', icon: '🔔', label: 'Follow-up', badge: true },
  { path: '/pipeline', icon: '💼', label: 'Pipeline' },
  { path: '/reports', icon: '📈', label: 'Báo cáo' },
  { path: '/users', icon: '👤', label: 'Người dùng', adminOnly: true },
  { path: '/areas', icon: '🗺️', label: 'Khu vực', adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: followData } = useQuery({
    queryKey: ['follow-badge'],
    queryFn: () => followUpsApi.list({ today_only: true }),
    refetchInterval: 60000,
  });

  const { data: overdueData } = useQuery({
    queryKey: ['overdue-badge'],
    queryFn: () => followUpsApi.list({ overdue: true }),
    refetchInterval: 60000,
  });

  const badgeCount = (followData?.pagination?.total || 0) + (overdueData?.pagination?.total || 0);
  const todayCount = followData?.pagination?.total || 0;
  const overdueCount = overdueData?.pagination?.total || 0;
  const [showAlert, setShowAlert] = useState(false);
  const alertShown = useRef(false);

  useEffect(() => {
    if (alertShown.current) return;
    const sessionKey = `followup_alert_${user?.user_id}_${new Date().toISOString().split('T')[0]}`;
    if (sessionStorage.getItem(sessionKey)) return;
    if ((todayCount > 0 || overdueCount > 0) && followData && overdueData) {
      alertShown.current = true;
      sessionStorage.setItem(sessionKey, '1');
      setShowAlert(true);
    }
  }, [todayCount, overdueCount, followData, overdueData, user?.user_id]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Follow-up daily alert */}
      {showAlert && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-xl shadow-lg border border-primary-200 p-4 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">📅 Công việc hôm nay</p>
              <div className="mt-1 space-y-0.5 text-sm text-gray-600">
                {todayCount > 0 && <p>• <strong className="text-primary-600">{todayCount}</strong> follow-up cần xử lý hôm nay</p>}
                {overdueCount > 0 && <p>• <strong className="text-red-600">{overdueCount}</strong> follow-up đã quá hạn</p>}
              </div>
              <Link to="/follow-ups" onClick={() => setShowAlert(false)} className="mt-2 inline-block text-xs text-primary-600 font-medium hover:underline">
                Xem ngay →
              </Link>
            </div>
            <button onClick={() => setShowAlert(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0">×</button>
          </div>
        </div>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-primary-800 text-white flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-primary-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-primary-700 font-bold text-lg">C</div>
            <div>
              <div className="font-bold text-white text-base leading-tight">CRM System</div>
              <div className="text-primary-300 text-xs">{user?.role}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map(item => {
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors ${active ? 'bg-primary-600 text-white' : 'text-primary-200 hover:bg-primary-700 hover:text-white'}`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && badgeCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-bold">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-primary-700">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {user?.full_name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.full_name}</div>
              <div className="text-xs text-primary-300 truncate">{user?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full mt-1 flex items-center gap-2 px-3 py-2 text-sm text-primary-200 hover:text-white hover:bg-primary-700 rounded-lg transition-colors">
            <span>🚪</span> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-primary-700 text-base">CRM System</span>
          {badgeCount > 0 && (
            <Link to="/follow-ups" className="ml-auto">
              <span className="bg-red-500 text-white text-xs rounded-full min-w-[22px] h-5.5 flex items-center justify-center px-2 font-bold">
                {badgeCount}
              </span>
            </Link>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
