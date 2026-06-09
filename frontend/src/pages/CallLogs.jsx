import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { callLogsApi, customersApi, usersApi, settingsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import Pagination from '../components/common/Pagination';
import { CALL_RESULT_COLORS, CALL_STATUS_COLORS, CUSTOMER_STATUSES, formatDate } from '../utils/constants';

export default function CallLogs() {
  const { canManage } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({ call_result: '', call_method: '', sale_id: '', date_from: today, date_to: today, page: 1, limit: 20 });
  const [modal, setModal] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [form, setForm] = useState({
    customer_id: '', call_date: today, call_time: '', call_result: '',
    call_method: 'Gọi điện', call_status: 'Kết thúc',
    call_content: '', customer_need: '', interest_level: '',
    next_action: '', follow_up_date: '', status_after_call: ''
  });

  const { data, isLoading } = useQuery({ queryKey: ['call-logs', filters], queryFn: () => callLogsApi.list(filters) });
  const { data: customers } = useQuery({ queryKey: ['customers-search', custSearch], queryFn: () => customersApi.list({ search: custSearch, limit: 20 }), enabled: custSearch.length >= 1 });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: canManage });
  const { data: lookupData } = useQuery({ queryKey: ['lookups'], queryFn: settingsApi.getLookupsPublic });
  const lkp = lookupData?.grouped || {};
  const callMethods = (lkp['call_method'] || []).map(x => x.value);
  const callStatuses = (lkp['call_status'] || []).map(x => x.value);
  const callResults = (lkp['call_result'] || []).map(x => x.value);
  const nextActions = (lkp['next_action'] || []).map(x => x.value);

  const mutCreate = useMutation({
    mutationFn: callLogsApi.create,
    onSuccess: () => { toast.success('Đã nhập cuộc gọi'); qc.invalidateQueries(['call-logs']); setModal(false); resetForm(); }
  });
  const mutDelete = useMutation({
    mutationFn: callLogsApi.delete,
    onSuccess: () => { toast.success('Đã xóa'); qc.invalidateQueries(['call-logs']); }
  });

  const resetForm = () => {
    setForm({ customer_id: '', call_date: today, call_time: '', call_result: '', call_method: 'Gọi điện', call_status: 'Kết thúc', call_content: '', customer_need: '', interest_level: '', next_action: '', follow_up_date: '', status_after_call: '' });
    setCustSearch('');
  };

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));
  const sales = users.filter(u => u.role === 'Sale' || u.role === 'Telesale');

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">📞 Lịch sử cuộc gọi</h1>
        <button onClick={() => { resetForm(); setModal(true); }} className="btn-primary btn-sm">+ Nhập cuộc gọi</button>
      </div>

      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select className="input" value={filters.call_result} onChange={e => setFilter('call_result', e.target.value)}>
            <option value="">Tất cả kết quả</option>
            {callResults.map(r => <option key={r}>{r}</option>)}
          </select>
          <select className="input" value={filters.call_method} onChange={e => setFilter('call_method', e.target.value)}>
            <option value="">Tất cả hình thức</option>
            {callMethods.map(m => <option key={m}>{m}</option>)}
          </select>
          {canManage && (
            <select className="input" value={filters.sale_id} onChange={e => setFilter('sale_id', e.target.value)}>
              <option value="">Tất cả sale</option>
              {sales.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </select>
          )}
          <div className="flex gap-1 items-center">
            <span className="text-sm text-gray-500 whitespace-nowrap">Từ</span>
            <input type="date" className="input" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} />
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-sm text-gray-500 whitespace-nowrap">Đến</span>
            <input type="date" className="input" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Khách hàng</th><th>Ngày / Giờ</th><th>Hình thức</th><th>Kết quả</th>
                <th>Trạng thái</th><th>Nội dung</th><th>Hành động tiếp</th><th>Follow-up</th>
                {canManage && <th>Sale</th>}
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400">Chưa có cuộc gọi nào</td></tr>
              ) : data.data.map(log => (
                <tr key={log.call_id}>
                  <td>
                    <Link to={`/customers/${log.customer_id}`} className="font-medium text-primary-600 hover:underline">{log.customer_name}</Link>
                    <div className="text-xs text-gray-400">{log.phone}</div>
                  </td>
                  <td className="text-sm text-gray-600 whitespace-nowrap">{formatDate(log.call_date)}<br/><span className="text-xs text-gray-400">{log.call_time || ''}</span></td>
                  <td><span className="badge badge-blue">{log.call_method || 'Gọi điện'}</span></td>
                  <td><span className={`${CALL_RESULT_COLORS[log.call_result] || 'badge-gray'} badge`}>{log.call_result}</span></td>
                  <td><span className={`${CALL_STATUS_COLORS[log.call_status] || 'badge-gray'} badge`}>{log.call_status || 'Kết thúc'}</span></td>
                  <td className="text-sm text-gray-600 max-w-[180px]"><p className="truncate">{log.call_content || '—'}</p></td>
                  <td className="text-sm text-gray-600">{log.next_action || '—'}</td>
                  <td className="text-sm text-gray-600">{log.follow_up_date ? <span className="badge-blue badge">{formatDate(log.follow_up_date)}</span> : '—'}</td>
                  {canManage && <td className="text-sm text-gray-600">{log.sale_name}</td>}
                  <td>
                    <button onClick={() => mutDelete.mutate(log.call_id)} className="btn-danger btn-sm px-2 py-1">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={data?.pagination} onPageChange={p => setFilters(f => ({ ...f, page: p }))} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="📞 Nhập kết quả cuộc gọi" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); mutCreate.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Tìm khách hàng *</label>
            <input className="input" placeholder="Nhập tên hoặc số điện thoại..." value={custSearch} onChange={e => { setCustSearch(e.target.value); setForm(f => ({ ...f, customer_id: '' })); }} />
            {customers?.data?.length > 0 && !form.customer_id && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {customers.data.map(c => (
                  <button key={c.customer_id} type="button" onClick={() => { setForm(f => ({ ...f, customer_id: String(c.customer_id) })); setCustSearch(c.customer_name + ' - ' + c.phone); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 border-b border-gray-100 last:border-0">
                    <span className="font-medium">{c.customer_name}</span> <span className="text-gray-400">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {form.customer_id && <p className="text-xs text-primary-600 mt-1">✓ Đã chọn khách hàng. <button type="button" onClick={() => { setForm(f => ({ ...f, customer_id: '' })); setCustSearch(''); }} className="underline">Đổi</button></p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Ngày gọi *</label><input type="date" className="input" required value={form.call_date} onChange={e => setForm(f => ({ ...f, call_date: e.target.value }))} /></div>
            <div><label className="label">Giờ gọi</label><input type="time" className="input" value={form.call_time} onChange={e => setForm(f => ({ ...f, call_time: e.target.value }))} /></div>
            <div>
              <label className="label">Hình thức liên hệ *</label>
              <select className="input" required value={form.call_method} onChange={e => setForm(f => ({ ...f, call_method: e.target.value }))}>
                {callMethods.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Kết quả *</label>
              <select className="input" required value={form.call_result} onChange={e => setForm(f => ({ ...f, call_result: e.target.value }))}>
                <option value="">-- Chọn kết quả --</option>
                {callResults.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Trạng thái xử lý</label>
              <select className="input" value={form.call_status} onChange={e => setForm(f => ({ ...f, call_status: e.target.value }))}>
                {callStatuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Hành động tiếp theo</label>
              <select className="input" value={form.next_action} onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))}>
                <option value="">-- Chọn --</option>
                {nextActions.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Trạng thái KH</label>
              <select className="input" value={form.status_after_call} onChange={e => setForm(f => ({ ...f, status_after_call: e.target.value }))}>
                <option value="">-- Không đổi --</option>
                {CUSTOMER_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Follow-up ngày</label><input type="date" className="input" value={form.follow_up_date} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} /></div>
          </div>
          <div><label className="label">Nội dung cuộc gọi</label><textarea className="input" rows={2} value={form.call_content} onChange={e => setForm(f => ({ ...f, call_content: e.target.value }))} placeholder="Ghi lại nội dung..." /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={mutCreate.isPending || !form.customer_id} className="btn-primary">
              {mutCreate.isPending ? 'Đang lưu...' : '💾 Lưu'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
