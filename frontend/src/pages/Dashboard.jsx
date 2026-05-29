import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { dashboardApi, usersApi, areasApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, STAGE_COLORS } from '../utils/constants';

const COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#f59e0b', '#ef4444'];

function StatCard({ icon, label, value, sub, color = 'teal', to }) {
  const colors = { teal: 'bg-primary-50 text-primary-700', blue: 'bg-blue-50 text-blue-700', yellow: 'bg-yellow-50 text-yellow-700', red: 'bg-red-50 text-red-700', green: 'bg-green-50 text-green-700' };
  const content = (
    <div className="stat-card">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${colors[color]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500 truncate">{label}</div>
        {sub && <div className={`text-xs mt-0.5 ${sub.includes('quá hạn') || sub.includes('❌') ? 'text-red-500' : 'text-gray-400'}`}>{sub}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function Dashboard() {
  const { isAdmin, canManage } = useAuth();
  const now = new Date();
  const [filters, setFilters] = useState({ month: now.getMonth() + 1, year: now.getFullYear(), sale_id: '', area_id: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => dashboardApi.get(filters),
  });

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: isAdmin });
  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: areasApi.list, enabled: isAdmin });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  const s = data?.summary || {};

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-3">
        <h1 className="page-title">📊 Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input w-auto" value={filters.month} onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
          </select>
          <select className="input w-auto" value={filters.year} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {isAdmin && (
            <>
              <select className="input w-auto" value={filters.sale_id} onChange={e => setFilters(f => ({ ...f, sale_id: e.target.value, area_id: '' }))}>
                <option value="">Tất cả sale</option>
                {users.filter(u => u.role === 'Sale' || u.role === 'Telesale').map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
              </select>
              <select className="input w-auto" value={filters.area_id} onChange={e => setFilters(f => ({ ...f, area_id: e.target.value, sale_id: '' }))}>
                <option value="">Tất cả khu vực</option>
                {areas.map(a => <option key={a.area_id} value={a.area_id}>{a.area_name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="👥" label="Tổng khách hàng" value={s.totalCustomers || 0} color="teal" to="/customers" />
        <StatCard icon="🆕" label="KH mới tháng này" value={s.newCustomers || 0} color="blue" />
        <StatCard icon="📞" label="Cuộc gọi hôm nay" value={s.callsToday || 0} color="green" to="/call-logs" />
        <StatCard icon="📅" label="Cuộc gọi tháng này" value={s.callsMonth || 0} color="blue" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon="🔔" label="Follow-up hôm nay" value={s.followToday || 0} color="yellow" to="/follow-ups" />
        <StatCard icon="⚠️" label="Quá hạn follow-up" value={s.followOverdue || 0} color="red" to="/follow-ups?overdue=true" />
        <StatCard icon="📱" label="Tỷ lệ nghe máy" value={`${s.answerRate || 0}%`} color="green" />
        <StatCard icon="💡" label="Tỷ lệ quan tâm" value={`${s.interestRate || 0}%`} color="blue" />
        <StatCard icon="🎯" label="Tỷ lệ chốt đơn" value={`${s.closeRate || 0}%`} color="teal" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer by status */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Khách hàng theo trạng thái</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data?.customerByStatus || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, count }) => `${status}: ${count}`}>
                {(data?.customerByStatus || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Call results */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Kết quả cuộc gọi tháng {filters.month}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.callStats || []} margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="call_result" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} name="Số cuộc" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline & Top sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Pipeline theo giai đoạn</h3>
          <div className="space-y-2">
            {(data?.pipelineStats || []).map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`badge text-xs ${STAGE_COLORS[s.stage] || 'badge-gray'} w-36 justify-center`}>{s.stage}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${Math.min(100, (s.count / Math.max(...(data?.pipelineStats || []).map(x => x.count), 1)) * 100)}%` }} />
                </div>
                <span className="text-sm text-gray-600 w-6 text-right">{s.count}</span>
                <span className="text-xs text-gray-400 w-28 text-right">{formatCurrency(s.total_value)}</span>
              </div>
            ))}
            {!data?.pipelineStats?.length && <p className="text-gray-400 text-sm text-center py-4">Chưa có dữ liệu</p>}
          </div>
        </div>

        {/* Top sales */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Top Sale theo cuộc gọi</h3>
          <div className="space-y-2">
            {(data?.topSalesCalls || []).map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg">{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i] || `${i + 1}.`}</span>
                <span className="flex-1 text-sm font-medium text-gray-700 truncate">{s.full_name}</span>
                <span className="text-primary-600 font-semibold text-sm">{s.call_count} cuộc</span>
              </div>
            ))}
            {!data?.topSalesCalls?.length && <p className="text-gray-400 text-sm text-center py-4">Chưa có dữ liệu</p>}
          </div>
          {canManage && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="font-medium text-gray-700 mb-2 text-sm">Top Sale chuyển đổi</h4>
              {(data?.topSalesConversion || []).map((s, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <span className="text-sm text-gray-500">{i + 1}.</span>
                  <span className="flex-1 text-sm text-gray-700 truncate">{s.full_name}</span>
                  <span className="badge-green badge">{s.converted} KH</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
