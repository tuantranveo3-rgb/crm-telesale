import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { followUpsApi, usersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/common/Pagination';
import { FOLLOW_STATUS_COLORS, FOLLOW_UP_STATUSES, FOLLOW_UP_TYPES, formatDate } from '../utils/constants';

export default function FollowUps() {
  const { canManage } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const today = new Date().toISOString().split('T')[0];

  const initOverdue = searchParams.get('overdue') === 'true';
  const [filters, setFilters] = useState({
    status: '', sale_id: '', date_from: '', date_to: '',
    today_only: !initOverdue ? 'true' : '',
    overdue: initOverdue ? 'true' : '',
    page: 1, limit: 20
  });
  const [activeView, setActiveView] = useState(initOverdue ? 'overdue' : 'today');

  const { data, isLoading } = useQuery({ queryKey: ['follow-ups', filters], queryFn: () => followUpsApi.list(filters) });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: canManage });

  const mutUpdate = useMutation({
    mutationFn: ({ id, data }) => followUpsApi.update(id, data),
    onSuccess: () => { toast.success('Đã cập nhật'); qc.invalidateQueries(['follow-ups']); }
  });
  const mutDelete = useMutation({
    mutationFn: followUpsApi.delete,
    onSuccess: () => { toast.success('Đã xóa'); qc.invalidateQueries(['follow-ups']); }
  });

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));

  const switchView = (view) => {
    setActiveView(view);
    setFilters(f => ({
      ...f, page: 1,
      today_only: view === 'today' ? 'true' : '',
      overdue: view === 'overdue' ? 'true' : '',
      status: view === 'all' ? f.status : '',
    }));
  };

  const sales = users.filter(u => u.role === 'Sale' || u.role === 'Telesale');

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">🔔 Follow-up</h1>
      </div>

      {/* View switcher */}
      <div className="flex gap-2">
        {[{ key: 'today', label: '📅 Hôm nay' }, { key: 'overdue', label: '⚠️ Quá hạn' }, { key: 'all', label: '📋 Tất cả' }].map(v => (
          <button key={v.key} onClick={() => switchView(v.key)}
            className={`btn-sm ${activeView === v.key ? 'btn-primary' : 'btn-secondary'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {activeView === 'all' && (
            <select className="input" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {FOLLOW_UP_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          )}
          {canManage && (
            <select className="input" value={filters.sale_id} onChange={e => setFilter('sale_id', e.target.value)}>
              <option value="">Tất cả sale</option>
              {sales.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </select>
          )}
          {activeView === 'all' && (
            <>
              <input type="date" className="input" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} />
              <input type="date" className="input" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} />
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      {activeView === 'today' && (
        <div className="p-3 bg-primary-50 rounded-xl text-primary-700 text-sm font-medium">
          📅 Có <strong>{data?.pagination?.total || 0}</strong> follow-up cần xử lý hôm nay ({today})
        </div>
      )}
      {activeView === 'overdue' && (
        <div className="p-3 bg-red-50 rounded-xl text-red-700 text-sm font-medium">
          ⚠️ <strong>{data?.pagination?.total || 0}</strong> follow-up đã quá hạn cần xử lý ngay!
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Khách hàng</th><th>Ngày follow-up</th><th>Hình thức</th>
                <th>Nội dung</th><th>Trạng thái</th>
                {canManage && <th>Sale</th>}
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">
                  {activeView === 'today' ? '🎉 Không có follow-up nào hôm nay!' : activeView === 'overdue' ? '✅ Không có follow-up quá hạn!' : 'Không có dữ liệu'}
                </td></tr>
              ) : data.data.map(fu => (
                <tr key={fu.followup_id} className={fu.status === 'Quá hạn' ? 'bg-red-50' : ''}>
                  <td>
                    <Link to={`/customers/${fu.customer_id}`} className="font-medium text-primary-600 hover:underline">{fu.customer_name}</Link>
                    <div className="text-xs text-gray-400">{fu.phone}</div>
                    {canManage && <div className="text-xs text-gray-400">{fu.customer_code}</div>}
                  </td>
                  <td className={`text-sm font-medium ${fu.status === 'Quá hạn' ? 'text-red-600' : 'text-gray-700'}`}>
                    {formatDate(fu.follow_up_date)}
                    {fu.follow_up_date < today && fu.status === 'Quá hạn' && <div className="text-xs text-red-500">Quá hạn!</div>}
                  </td>
                  <td><span className="badge badge-blue">{fu.follow_up_type}</span></td>
                  <td className="text-sm text-gray-600 max-w-[200px]"><p className="truncate">{fu.content || '—'}</p></td>
                  <td><span className={`${FOLLOW_STATUS_COLORS[fu.status] || 'badge-gray'} badge`}>{fu.status}</span></td>
                  {canManage && <td className="text-sm text-gray-600">{fu.sale_name}</td>}
                  <td>
                    <div className="flex gap-1">
                      {(fu.status === 'Chưa xử lý' || fu.status === 'Quá hạn') && (
                        <button onClick={() => mutUpdate.mutate({ id: fu.followup_id, data: { status: 'Đã xử lý' } })}
                          className="btn-primary btn-sm px-2 py-1 text-xs">✓ Xong</button>
                      )}
                      <button onClick={() => mutUpdate.mutate({ id: fu.followup_id, data: { status: 'Hủy' } })}
                        className="btn-secondary btn-sm px-2 py-1 text-xs">Hủy</button>
                      <button onClick={() => mutDelete.mutate(fu.followup_id)} className="btn-danger btn-sm px-2 py-1">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={data?.pagination} onPageChange={p => setFilters(f => ({ ...f, page: p }))} />
      </div>
    </div>
  );
}
