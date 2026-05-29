import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { reportsApi, usersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/constants';

export default function Reports() {
  const { canManage } = useAuth();
  const [tab, setTab] = useState('calls');
  const now = new Date();
  const [filters, setFilters] = useState({ sale_id: '', date_from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, date_to: now.toISOString().split('T')[0] });

  const { data: callData = [] } = useQuery({ queryKey: ['report-calls', filters], queryFn: () => reportsApi.calls(filters), enabled: tab === 'calls' });
  const { data: custData = [] } = useQuery({ queryKey: ['report-customers', filters], queryFn: () => reportsApi.customers(filters), enabled: tab === 'customers' });
  const { data: overdueData = [] } = useQuery({ queryKey: ['report-followups'], queryFn: reportsApi.followups, enabled: tab === 'followups' });
  const { data: pipelineData = [] } = useQuery({ queryKey: ['report-pipeline'], queryFn: reportsApi.pipeline, enabled: tab === 'pipeline' });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: canManage });

  const sales = users.filter(u => u.role === 'Sale' || u.role === 'Telesale');

  // Aggregate call data by sale
  const callBySale = callData.reduce((acc, row) => {
    if (!acc[row.sale_name]) acc[row.sale_name] = { sale_name: row.sale_name, total: 0 };
    acc[row.sale_name].total += row.count;
    acc[row.sale_name][row.call_result] = row.count;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">📈 Báo cáo</h1>
        <button onClick={() => reportsApi.exportExcel(tab === 'calls' ? 'calls' : 'customers')} className="btn-secondary btn-sm">📥 Export Excel</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {[{ key: 'calls', label: '📞 Cuộc gọi' }, { key: 'customers', label: '👥 Khách hàng' }, { key: 'followups', label: '⚠️ Follow-up quá hạn' }, { key: 'pipeline', label: '💼 Pipeline' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {(tab === 'calls' || tab === 'customers') && (
        <div className="card">
          <div className="flex gap-3 flex-wrap">
            {canManage && (
              <select className="input w-auto" value={filters.sale_id} onChange={e => setFilters(f => ({ ...f, sale_id: e.target.value }))}>
                <option value="">Tất cả sale</option>
                {sales.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
              </select>
            )}
            <div className="flex items-center gap-2">
              <input type="date" className="input w-auto" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
              <span className="text-gray-400">—</span>
              <input type="date" className="input w-auto" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
            </div>
          </div>
        </div>
      )}

      {/* Call report */}
      {tab === 'calls' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Cuộc gọi theo sale</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={Object.values(callBySale)} margin={{ bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="sale_name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Nghe máy" fill="#0d9488" name="Nghe máy" stackId="a" />
                <Bar dataKey="Quan tâm" fill="#14b8a6" name="Quan tâm" stackId="a" />
                <Bar dataKey="Chốt đơn" fill="#2dd4bf" name="Chốt đơn" stackId="a" />
                <Bar dataKey="Không nghe" fill="#f59e0b" name="Không nghe" stackId="a" />
                <Bar dataKey="Từ chối" fill="#ef4444" name="Từ chối" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Sale</th><th>Kết quả</th><th>Số cuộc</th></tr></thead>
                <tbody>
                  {callData.map((row, i) => (
                    <tr key={i}><td className="font-medium">{row.sale_name}</td><td><span className="badge badge-teal">{row.call_result}</span></td><td className="font-semibold text-primary-600">{row.count}</td></tr>
                  ))}
                  {!callData.length && <tr><td colSpan={3} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Customer report */}
      {tab === 'customers' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Sale</th><th>Khu vực</th><th>Trạng thái</th><th>Tổng KH</th><th>Đã mua</th><th>Tỷ lệ</th></tr></thead>
              <tbody>
                {custData.map((row, i) => (
                  <tr key={i}>
                    <td className="font-medium">{row.sale_name || '—'}</td>
                    <td className="text-sm text-gray-600">{row.area_name || '—'}</td>
                    <td><span className="badge badge-teal">{row.status}</span></td>
                    <td className="font-semibold">{row.total}</td>
                    <td className="text-green-600 font-medium">{row.converted}</td>
                    <td>{row.total ? Math.round((row.converted / row.total) * 100) : 0}%</td>
                  </tr>
                ))}
                {!custData.length && <tr><td colSpan={6} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Follow-up overdue */}
      {tab === 'followups' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Khách hàng</th><th>SĐT</th><th>Sale</th><th>Ngày follow-up</th><th>Hình thức</th><th>Nội dung</th></tr></thead>
              <tbody>
                {overdueData.map((row, i) => (
                  <tr key={i} className="bg-red-50">
                    <td className="font-medium text-red-600">{row.customer_name}</td>
                    <td>{row.phone}</td>
                    <td>{row.sale_name}</td>
                    <td className="text-red-600 font-medium">{row.follow_up_date}</td>
                    <td><span className="badge badge-yellow">{row.follow_up_type}</span></td>
                    <td className="text-sm text-gray-600">{row.content || '—'}</td>
                  </tr>
                ))}
                {!overdueData.length && <tr><td colSpan={6} className="text-center py-10 text-green-500">✅ Không có follow-up quá hạn!</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pipeline report */}
      {tab === 'pipeline' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Chốt đơn', 'Đang đàm phán', 'Gửi báo giá', 'Quan tâm'].map(stage => {
              const rows = pipelineData.filter(r => r.stage === stage);
              const total = rows.reduce((s, r) => s + (r.total_value || 0), 0);
              const count = rows.reduce((s, r) => s + (r.count || 0), 0);
              return (
                <div key={stage} className="card">
                  <div className="text-sm text-gray-500">{stage}</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{count}</div>
                  <div className="text-sm text-primary-600 font-medium">{formatCurrency(total)}</div>
                </div>
              );
            })}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Giai đoạn</th><th>Sale</th><th>Số cơ hội</th><th>Tổng giá trị</th><th>Xác suất TB</th></tr></thead>
                <tbody>
                  {pipelineData.map((row, i) => (
                    <tr key={i}>
                      <td><span className="badge badge-teal">{row.stage}</span></td>
                      <td className="font-medium">{row.sale_name}</td>
                      <td>{row.count}</td>
                      <td className="font-semibold text-primary-600">{formatCurrency(row.total_value)}</td>
                      <td>{Math.round(row.avg_probability || 0)}%</td>
                    </tr>
                  ))}
                  {!pipelineData.length && <tr><td colSpan={5} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
