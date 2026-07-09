import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { reportsApi, usersApi, settingsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatDate, CALL_RESULT_COLORS, CALL_STATUS_COLORS } from '../utils/constants';
import Pagination from '../components/common/Pagination';

const RESULT_COLORS_HEX = {
  'Nghe máy': '#0d9488', 'Quan tâm': '#14b8a6', 'Chốt đơn': '#2dd4bf',
  'Hẹn gọi lại': '#3b82f6', 'Không nghe': '#f59e0b', 'Máy bận': '#f97316', 'Từ chối': '#ef4444',
};
const PIE_COLORS = ['#0d9488','#14b8a6','#2dd4bf','#3b82f6','#f59e0b','#f97316','#ef4444','#8b5cf6'];

const TABS = [
  { key: 'overview', label: '📊 Tổng quan' },
  { key: 'call-details', label: '📞 Chi tiết gọi' },
  { key: 'sale-performance', label: '👤 Hiệu suất Sale' },
  { key: 'calls-by-customer', label: '🏪 Gọi theo KH' },
  { key: 'followups', label: '⚠️ Follow-up' },
  { key: 'pipeline', label: '💼 Pipeline' },
];

function formatCurrency(n) {
  if (!n) return '0đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

function KpiCard({ label, value, sub, color = 'teal' }) {
  const colors = { teal: 'from-teal-500 to-teal-600', blue: 'from-blue-500 to-blue-600', amber: 'from-amber-500 to-amber-600', red: 'from-red-500 to-red-600', green: 'from-green-500 to-green-600' };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${colors[color]} text-white p-4 shadow-sm`}>
      <div className="text-sm opacity-80">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

export default function Reports() {
  const { canManage, user } = useAuth();
  const [tab, setTab] = useState('overview');
  const now = new Date();
  const thisMonthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];
  const [filters, setFilters] = useState({ date_from: thisMonthFrom, date_to: today, sale_id: '', call_result: '', call_method: '', call_status: '' });
  const [detailPage, setDetailPage] = useState(1);
  const [custSearch, setCustSearch] = useState('');
  const [followupGroup, setFollowupGroup] = useState('all'); // all | overdue | today | upcoming | done

  const f = { ...filters, page: detailPage, limit: 50 };

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: canManage });
  const { data: lookupData } = useQuery({ queryKey: ['lookups'], queryFn: settingsApi.getLookupsPublic });
  const lkp = lookupData?.grouped || {};
  const callResults = (lkp['call_result'] || []).map(x => x.value);
  const callMethods = (lkp['call_method'] || []).map(x => x.value);
  const callStatuses = (lkp['call_status'] || []).map(x => x.value);
  const sales = users.filter(u => u.role === 'Sale' || u.role === 'Telesale');

  const { data: overviewData, isLoading: loadingOverview } = useQuery({ queryKey: ['report-overview', filters], queryFn: () => reportsApi.overview(filters), enabled: tab === 'overview' });
  const { data: callDetailData, isLoading: loadingDetails } = useQuery({ queryKey: ['report-call-details', f], queryFn: () => reportsApi.callDetails(f), enabled: tab === 'call-details' });
  const { data: salePerf = [], isLoading: loadingPerf } = useQuery({ queryKey: ['report-sale-perf', filters], queryFn: () => reportsApi.salePerformance(filters), enabled: tab === 'sale-performance' });
  const { data: custCallData = [], isLoading: loadingCust } = useQuery({ queryKey: ['report-cust-calls', filters, custSearch], queryFn: () => reportsApi.callsByCustomer({ ...filters, search: custSearch }), enabled: tab === 'calls-by-customer' });
  const { data: followupData = [], isLoading: loadingFollowup } = useQuery({ queryKey: ['report-followups', filters], queryFn: () => reportsApi.followups(filters), enabled: tab === 'followups' });
  const { data: pipelineData = [] } = useQuery({ queryKey: ['report-pipeline'], queryFn: reportsApi.pipeline, enabled: tab === 'pipeline' });

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setDetailPage(1); };

  const followupFiltered = followupData.filter(r => followupGroup === 'all' ? true : r.urgency === followupGroup);
  const followupCounts = { overdue: followupData.filter(r => r.urgency === 'overdue').length, today: followupData.filter(r => r.urgency === 'today').length, upcoming: followupData.filter(r => r.urgency === 'upcoming').length, done: followupData.filter(r => r.urgency === 'done').length };

  const exportCurrent = () => {
    if (tab === 'call-details') reportsApi.exportExcel('call-details', filters);
    else if (tab === 'sale-performance') reportsApi.exportExcel('sale-performance', filters);
    else reportsApi.exportExcel('calls', filters);
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">📈 Báo cáo</h1>
        <button onClick={exportCurrent} className="btn-secondary btn-sm">📥 Export Excel</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors -mb-px ${tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Common date + sale filters */}
      {tab !== 'pipeline' && (
        <div className="card">
          <div className="flex gap-3 flex-wrap items-center">
            {canManage && tab !== 'followups' && (
              <select className="input w-auto" value={filters.sale_id} onChange={e => setFilter('sale_id', e.target.value)}>
                <option value="">Tất cả sale</option>
                {sales.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
              </select>
            )}
            {canManage && tab === 'followups' && (
              <select className="input w-auto" value={filters.sale_id} onChange={e => setFilter('sale_id', e.target.value)}>
                <option value="">Tất cả sale</option>
                {sales.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
              </select>
            )}
            {tab !== 'followups' && (
              <>
                <input type="date" className="input w-auto" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} />
                <span className="text-gray-400">—</span>
                <input type="date" className="input w-auto" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} />
              </>
            )}
            {tab === 'call-details' && (
              <>
                <select className="input w-auto" value={filters.call_result} onChange={e => setFilter('call_result', e.target.value)}>
                  <option value="">Tất cả kết quả</option>
                  {callResults.map(r => <option key={r}>{r}</option>)}
                </select>
                <select className="input w-auto" value={filters.call_method} onChange={e => setFilter('call_method', e.target.value)}>
                  <option value="">Tất cả hình thức</option>
                  {callMethods.map(m => <option key={m}>{m}</option>)}
                </select>
                <select className="input w-auto" value={filters.call_status} onChange={e => setFilter('call_status', e.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  {callStatuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </>
            )}
            {tab === 'calls-by-customer' && (
              <input className="input w-auto" placeholder="🔍 Tìm KH..." value={custSearch} onChange={e => setCustSearch(e.target.value)} />
            )}
          </div>
        </div>
      )}

      {/* ── TỔNG QUAN ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {loadingOverview ? <div className="card text-center text-gray-400 py-10">Đang tải...</div> : overviewData && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="Tổng cuộc gọi" value={overviewData.kpis.totalCalls} sub="trong kỳ" color="teal" />
                <KpiCard label="KH mới" value={overviewData.kpis.newCustomers} sub="trong kỳ" color="blue" />
                <KpiCard label="Chốt đơn" value={overviewData.kpis.closedDeals} sub="cuộc gọi" color="green" />
                <KpiCard label="Follow-up hôm nay" value={overviewData.kpis.followupToday} sub="cần xử lý" color="amber" />
                <KpiCard label="Follow-up quá hạn" value={overviewData.kpis.followupOverdue} sub="chưa xử lý" color="red" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card md:col-span-2">
                  <h3 className="font-semibold text-gray-700 mb-3">Cuộc gọi theo ngày</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={overviewData.byDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d ? d.slice(5) : ''} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip labelFormatter={d => `Ngày ${d}`} />
                      <Line type="monotone" dataKey="total" stroke="#0d9488" name="Tổng gọi" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="closed" stroke="#2dd4bf" name="Chốt đơn" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="interested" stroke="#3b82f6" name="Quan tâm" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="card">
                  <h3 className="font-semibold text-gray-700 mb-3">Kết quả gọi</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={overviewData.byResult} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''} labelLine={false} fontSize={10}>
                        {overviewData.byResult.map((entry, i) => <Cell key={i} fill={RESULT_COLORS_HEX[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-gray-700 mb-3">Hình thức liên hệ</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={overviewData.byMethod} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0d9488" name="Số cuộc" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CHI TIẾT CUỘC GỌI ── */}
      {tab === 'call-details' && (
        <div className="space-y-3">
          {callDetailData && (
            <div className="flex gap-3 text-sm text-gray-600">
              <span className="font-medium text-primary-600">{callDetailData.pagination?.total || 0} cuộc gọi</span>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày / Giờ</th><th>Khách hàng</th><th>Sale</th>
                    <th>Hình thức</th><th>Kết quả</th><th>Trạng thái</th>
                    <th>Nội dung cuộc gọi</th><th>Hành động tiếp</th><th>Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDetails ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
                  ) : !callDetailData?.data?.length ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>
                  ) : callDetailData.data.map(row => (
                    <tr key={row.call_id}>
                      <td className="whitespace-nowrap text-sm">
                        <div>{formatDate(row.call_date)}</div>
                        <div className="text-xs text-gray-400">{row.call_time || ''}</div>
                      </td>
                      <td>
                        <Link to={`/customers/${row.customer_id}`} className="font-medium text-primary-600 hover:underline">{row.customer_name}</Link>
                        <div className="text-xs text-gray-400">{row.phone}</div>
                      </td>
                      <td className="text-sm text-gray-700">{row.sale_name}</td>
                      <td><span className="badge badge-blue">{row.call_method || 'Gọi điện'}</span></td>
                      <td><span className={`badge ${CALL_RESULT_COLORS[row.call_result] || 'badge-gray'}`}>{row.call_result}</span></td>
                      <td><span className={`badge ${CALL_STATUS_COLORS[row.call_status] || 'badge-gray'}`}>{row.call_status || 'Kết thúc'}</span></td>
                      <td className="text-sm text-gray-600 max-w-[220px]"><p className="line-clamp-2">{row.call_content || '—'}</p></td>
                      <td className="text-sm text-gray-600 whitespace-nowrap">{row.next_action || '—'}</td>
                      <td className="text-sm whitespace-nowrap">{row.follow_up_date ? <span className="badge badge-blue">{formatDate(row.follow_up_date)}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={callDetailData?.pagination} onPageChange={p => setDetailPage(p)} />
          </div>
        </div>
      )}

      {/* ── HIỆU SUẤT SALE ── */}
      {tab === 'sale-performance' && (
        <div className="space-y-4">
          {/* Chart */}
          {salePerf.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-3">So sánh hiệu suất</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={salePerf} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="sale_name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_calls" fill="#0d9488" name="Tổng gọi" />
                  <Bar dataKey="answered" fill="#14b8a6" name="Nghe máy" />
                  <Bar dataKey="interested" fill="#3b82f6" name="Quan tâm" />
                  <Bar dataKey="closed" fill="#2dd4bf" name="Chốt đơn" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sale</th><th>Khu vực</th><th>Tổng gọi</th><th>KH tiếp cận</th>
                    <th>Nghe máy</th><th>Quan tâm</th><th>Chốt đơn</th>
                    <th>Không nghe</th><th>Từ chối</th><th>Tỷ lệ CĐ</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPerf ? (
                    <tr><td colSpan={10} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
                  ) : !salePerf.length ? (
                    <tr><td colSpan={10} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>
                  ) : salePerf.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="font-semibold text-gray-800">{row.sale_name}</td>
                      <td className="text-sm text-gray-500">{row.area_name || '—'}</td>
                      <td><span className="font-bold text-primary-600">{row.total_calls}</span></td>
                      <td>{row.unique_customers}</td>
                      <td><span className="text-green-600 font-medium">{row.answered}</span></td>
                      <td><span className="text-blue-600 font-medium">{row.interested}</span></td>
                      <td><span className="text-teal-600 font-bold">{row.closed}</span></td>
                      <td><span className="text-amber-600">{row.no_answer}</span></td>
                      <td><span className="text-red-500">{row.rejected}</span></td>
                      <td>
                        <span className={`font-semibold ${row.total_calls > 0 && (row.closed / row.total_calls) >= 0.1 ? 'text-green-600' : 'text-gray-600'}`}>
                          {row.total_calls > 0 ? Math.round((row.closed / row.total_calls) * 100) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {salePerf.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td className="font-bold text-gray-700 px-3 py-2" colSpan={2}>Tổng cộng</td>
                      <td className="font-bold text-primary-600 px-3 py-2">{salePerf.reduce((s, r) => s + (r.total_calls || 0), 0)}</td>
                      <td className="px-3 py-2">{salePerf.reduce((s, r) => s + (r.unique_customers || 0), 0)}</td>
                      <td className="text-green-600 font-medium px-3 py-2">{salePerf.reduce((s, r) => s + (r.answered || 0), 0)}</td>
                      <td className="text-blue-600 font-medium px-3 py-2">{salePerf.reduce((s, r) => s + (r.interested || 0), 0)}</td>
                      <td className="text-teal-600 font-bold px-3 py-2">{salePerf.reduce((s, r) => s + (r.closed || 0), 0)}</td>
                      <td className="text-amber-600 px-3 py-2">{salePerf.reduce((s, r) => s + (r.no_answer || 0), 0)}</td>
                      <td className="text-red-500 px-3 py-2">{salePerf.reduce((s, r) => s + (r.rejected || 0), 0)}</td>
                      <td className="px-3 py-2">—</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── GỌI THEO KH ── */}
      {tab === 'calls-by-customer' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã KH</th><th>Khách hàng</th><th>Sale</th>
                  <th>Số cuộc gọi</th><th>Lần gọi cuối</th><th>Quan tâm</th><th>Chốt đơn</th><th>Trạng thái KH</th>
                </tr>
              </thead>
              <tbody>
                {loadingCust ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
                ) : !custCallData.length ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>
                ) : custCallData.map((row, i) => (
                  <tr key={i}>
                    <td><span className="text-xs font-mono text-gray-500">{row.customer_code}</span></td>
                    <td>
                      <Link to={`/customers/${row.customer_id}`} className="font-medium text-primary-600 hover:underline">{row.customer_name}</Link>
                      <div className="text-xs text-gray-400">{row.phone}</div>
                    </td>
                    <td className="text-sm text-gray-600">{row.sale_name || '—'}</td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${row.call_count >= 5 ? 'bg-red-100 text-red-700' : row.call_count >= 3 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {row.call_count} lần
                      </span>
                    </td>
                    <td className="text-sm text-gray-600">{row.last_call_date ? formatDate(row.last_call_date) : '—'}</td>
                    <td>{row.interested_count > 0 ? <span className="badge badge-blue">{row.interested_count}</span> : '—'}</td>
                    <td>{row.closed_count > 0 ? <span className="badge badge-teal font-bold">{row.closed_count}</span> : '—'}</td>
                    <td><span className="badge badge-gray">{row.customer_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FOLLOW-UP ── */}
      {tab === 'followups' && (
        <div className="space-y-3">
          {/* Group tabs */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: `Tất cả (${followupData.length})` },
              { key: 'overdue', label: `⚠️ Quá hạn (${followupCounts.overdue})`, cls: followupCounts.overdue > 0 ? 'text-red-600' : '' },
              { key: 'today', label: `📅 Hôm nay (${followupCounts.today})`, cls: 'text-amber-600' },
              { key: 'upcoming', label: `🔜 Sắp tới (${followupCounts.upcoming})`, cls: 'text-blue-600' },
              { key: 'done', label: `✅ Đã xử lý (${followupCounts.done})`, cls: 'text-green-600' },
            ].map(g => (
              <button key={g.key} onClick={() => setFollowupGroup(g.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${followupGroup === g.key ? 'bg-primary-600 text-white border-primary-600' : `bg-white border-gray-200 hover:border-primary-300 ${g.cls}`}`}>
                {g.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Khách hàng</th><th>SĐT</th><th>Sale</th><th>Ngày follow-up</th><th>Hình thức</th><th>Nội dung</th><th>Trạng thái</th></tr>
                </thead>
                <tbody>
                  {loadingFollowup ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
                  ) : !followupFiltered.length ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>
                  ) : followupFiltered.map((row, i) => {
                    const rowCls = row.urgency === 'overdue' ? 'bg-red-50' : row.urgency === 'today' ? 'bg-amber-50' : '';
                    return (
                      <tr key={i} className={rowCls}>
                        <td>
                          <Link to={`/customers/${row.customer_id}`} className={`font-medium hover:underline ${row.urgency === 'overdue' ? 'text-red-600' : 'text-primary-600'}`}>{row.customer_name}</Link>
                        </td>
                        <td className="text-sm">{row.phone}</td>
                        <td className="text-sm text-gray-600">{row.sale_name}</td>
                        <td className={`font-medium text-sm ${row.urgency === 'overdue' ? 'text-red-600' : row.urgency === 'today' ? 'text-amber-600' : 'text-gray-700'}`}>{formatDate(row.follow_up_date)}</td>
                        <td><span className="badge badge-blue">{row.follow_up_type}</span></td>
                        <td className="text-sm text-gray-600 max-w-[200px]"><p className="truncate">{row.content || '—'}</p></td>
                        <td>
                          <span className={`badge ${row.status === 'Đã xử lý' ? 'badge-teal' : row.urgency === 'overdue' ? 'badge-red' : 'badge-yellow'}`}>{row.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PIPELINE ── */}
      {tab === 'pipeline' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Chốt đơn', 'Đang đàm phán', 'Gửi báo giá', 'Quan tâm'].map(stage => {
              const stageRows = pipelineData.filter(r => r.stage === stage);
              const total = stageRows.reduce((s, r) => s + (r.total_value || 0), 0);
              const count = stageRows.reduce((s, r) => s + (r.count || 0), 0);
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
