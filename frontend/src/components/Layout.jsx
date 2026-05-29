import { useState, useEffect } from 'react';
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

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
