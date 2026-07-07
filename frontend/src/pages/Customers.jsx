import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { customersApi, usersApi, areasApi, settingsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Pagination from '../components/common/Pagination';
import { STATUS_COLORS, POTENTIAL_COLORS, SOURCES, POTENTIAL_LEVELS, CUSTOMER_STATUSES, formatDate } from '../utils/constants';

const EMPTY_FORM = { customer_name: '', phone: '', zalo: '', address: '', province: '', district: '', ward: '', sales_channel: '', customer_type: '', segment: '', chain_system: '', source: '', potential_level: '', status: 'Khách mới', assigned_sale_id: '', area_id: '', note: '' };

export default function Customers() {
  const { canManage, isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ search: '', sale_id: '', area_id: '', status: '', sales_channel: '', customer_type: '', segment: '', potential_level: '', page: 1, limit: 20 });
  const [modal, setModal] = useState(null); // null | 'create' | 'edit' | 'import'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const { data, isLoading } = useQuery({
    queryKey: ['customers', filters],
    queryFn: () => customersApi.list(filters),
  });

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: canManage });
  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: areasApi.list });
  const { data: lookupData } = useQuery({ queryKey: ['lookups'], queryFn: settingsApi.getLookupsPublic });
  const lkp = lookupData?.grouped || {};
  const channels = lkp['sales_channel'] || [];
  const customerTypesByChannel = (ch) => (lkp['customer_type'] || []).filter(x => !ch || x.parent_value === ch);
  const segmentsByChannel = (ch) => (lkp['segment'] || []).filter(x => !ch || x.parent_value === ch);
  const systemsByChannel = (ch) => (lkp['chain_system'] || []).filter(x => !ch || x.parent_value === ch);

  const mutCreate = useMutation({ mutationFn: customersApi.create, onSuccess: () => { toast.success('Thêm khách hàng thành công'); qc.invalidateQueries(['customers']); closeModal(); } });
  const mutUpdate = useMutation({ mutationFn: ({ id, data }) => customersApi.update(id, data), onSuccess: () => { toast.success('Cập nhật thành công'); qc.invalidateQueries(['customers']); closeModal(); } });
  const mutDelete = useMutation({ mutationFn: customersApi.delete, onSuccess: () => { toast.success('Đã xóa khách hàng'); qc.invalidateQueries(['customers']); setDeleteId(null); } });
  const mutBulkDelete = useMutation({
    mutationFn: () => customersApi.bulkDelete(selectedIds),
    onSuccess: (res) => { toast.success(res.message); qc.invalidateQueries(['customers']); setSelectedIds([]); setShowBulkConfirm(false); }
  });
  const mutImport = useMutation({
    mutationFn: customersApi.importExcel,
    onSuccess: (res) => {
      qc.invalidateQueries(['customers']);
      if (res.errors?.length > 0) {
        setImportResult(res);
        setModal('import-result');
      } else {
        toast.success(res.message);
        closeModal();
      }
    }
  });

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setModal('create'); };
  const openEdit = (c) => { setForm({ ...c, assigned_sale_id: c.assigned_sale_id || '', area_id: c.area_id || '' }); setEditing(c); setModal('edit'); };
  const closeModal = () => { setModal(null); setEditing(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) mutUpdate.mutate({ id: editing.customer_id, data: form });
    else mutCreate.mutate(form);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    mutImport.mutate(file);
    e.target.value = '';
  };

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));

  const sales = users.filter(u => u.role === 'Sale' || u.role === 'Telesale');
  const rows = data?.data || [];
  const allPageIds = rows.map(c => c.customer_id);
  const allPageSelected = allPageIds.length > 0 && allPageIds.every(id => selectedIds.includes(id));
  const toggleSelectAll = () => {
    if (allPageSelected) setSelectedIds(prev => prev.filter(id => !allPageIds.includes(id)));
    else setSelectedIds(prev => [...new Set([...prev, ...allPageIds])]);
  };
  const toggleOne = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">👥 Khách hàng</h1>
        <div className="flex gap-2 flex-wrap items-center">
          {canManage && selectedIds.length > 0 && (
            <button onClick={() => setShowBulkConfirm(true)} className="btn-danger btn-sm">
              🗑 Xóa đã chọn ({selectedIds.length})
            </button>
          )}
          {canManage && (
            <>
              <button onClick={() => customersApi.exportExcel()} className="btn-secondary btn-sm">📥 Export</button>
              <button onClick={() => customersApi.downloadTemplate()} className="btn-secondary btn-sm">📋 Template</button>
              <button onClick={() => fileRef.current.click()} className="btn-secondary btn-sm">📤 Import</button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            </>
          )}
          <button onClick={openCreate} className="btn-primary btn-sm">+ Thêm khách hàng</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input className="input" placeholder="🔍 Tìm kiếm..." value={filters.search} onChange={e => setFilter('search', e.target.value)} />
          <select className="input" value={filters.sales_channel} onChange={e => { setFilter('sales_channel', e.target.value); setFilter('customer_type', ''); setFilter('segment', ''); }}>
            <option value="">Tất cả kênh BH</option>
            {channels.map(c => <option key={c.id} value={c.value}>{c.value}</option>)}
          </select>
          <select className="input" value={filters.customer_type} onChange={e => setFilter('customer_type', e.target.value)}>
            <option value="">Tất cả loại KH</option>
            {customerTypesByChannel(filters.sales_channel).map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
          </select>
          <select className="input" value={filters.segment} onChange={e => setFilter('segment', e.target.value)}>
            <option value="">Tất cả phân khúc</option>
            {segmentsByChannel(filters.sales_channel).map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
          </select>
          <select className="input" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {CUSTOMER_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="input" value={filters.potential_level} onChange={e => setFilter('potential_level', e.target.value)}>
            <option value="">Tất cả tiềm năng</option>
            {POTENTIAL_LEVELS.map(s => <option key={s}>{s}</option>)}
          </select>
          {canManage && (
            <select className="input" value={filters.sale_id} onChange={e => setFilter('sale_id', e.target.value)}>
              <option value="">Tất cả sale</option>
              {sales.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </select>
          )}
          {isAdmin && (
            <select className="input" value={filters.area_id} onChange={e => setFilter('area_id', e.target.value)}>
              <option value="">Tất cả khu vực</option>
              {areas.map(a => <option key={a.area_id} value={a.area_id}>{a.area_name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                {canManage && <th><input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="w-4 h-4 cursor-pointer" /></th>}
                <th>Mã KH</th><th>Khách hàng</th><th>Số điện thoại</th>
                <th>Loại KH</th><th>Tiềm năng</th><th>Trạng thái</th>
                {canManage && <th>Sale phụ trách</th>}
                <th>Ngày tạo</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>
              ) : rows.map(c => (
                <tr key={c.customer_id} className={selectedIds.includes(c.customer_id) ? 'bg-primary-50' : ''}>
                  {canManage && <td><input type="checkbox" checked={selectedIds.includes(c.customer_id)} onChange={() => toggleOne(c.customer_id)} className="w-4 h-4 cursor-pointer" /></td>}
                  <td><span className="text-xs font-mono text-gray-500">{c.customer_code}</span></td>
                  <td>
                    <Link to={`/customers/${c.customer_id}`} className="font-medium text-primary-600 hover:text-primary-800">{c.customer_name}</Link>
                    {c.address && <div className="text-xs text-gray-400 truncate max-w-[180px]">{c.address}</div>}
                  </td>
                  <td>
                    <a href={`tel:${c.phone}`} className="text-sm text-gray-700 hover:text-primary-600">{c.phone}</a>
                    {c.zalo && <div className="text-xs text-blue-500">Zalo: {c.zalo}</div>}
                  </td>
                  <td><span className="badge badge-teal">{c.customer_type || '—'}</span></td>
                  <td><span className={c.potential_level ? POTENTIAL_COLORS[c.potential_level] : 'badge-gray'}>{c.potential_level || '—'}</span></td>
                  <td><span className={STATUS_COLORS[c.status] || 'badge-gray'}>{c.status}</span></td>
                  {canManage && <td className="text-sm text-gray-600">{c.sale_name || '—'}</td>}
                  <td className="text-xs text-gray-400">{formatDate(c.created_at)}</td>
                  <td>
                    <div className="flex gap-1">
                      <Link to={`/customers/${c.customer_id}`} className="btn-secondary btn-sm px-2 py-1">👁</Link>
                      {(canManage || c.assigned_sale_id === user?.user_id) && (
                        <button onClick={() => openEdit(c)} className="btn-secondary btn-sm px-2 py-1">✏️</button>
                      )}
                      {canManage && <button onClick={() => setDeleteId(c.customer_id)} className="btn-danger btn-sm px-2 py-1">🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={data?.pagination} onPageChange={p => setFilters(f => ({ ...f, page: p }))} />
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={closeModal} title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng mới'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Tên khách hàng *</label>
              <input className="input" required value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Nhập tên..." />
            </div>
            <div>
              <label className="label">Số điện thoại *</label>
              <input className="input" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0912..." />
            </div>
            <div>
              <label className="label">Zalo</label>
              <input className="input" value={form.zalo} onChange={e => setForm(f => ({ ...f, zalo: e.target.value }))} placeholder="Số Zalo..." />
            </div>
            <div>
              <label className="label">Kênh bán hàng</label>
              <select className="input" value={form.sales_channel} onChange={e => setForm(f => ({ ...f, sales_channel: e.target.value, customer_type: '', segment: '', chain_system: '' }))}>
                <option value="">-- Chọn kênh --</option>
                {channels.map(c => <option key={c.id} value={c.value}>{c.value}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Loại khách hàng</label>
              <select className="input" value={form.customer_type} onChange={e => setForm(f => ({ ...f, customer_type: e.target.value }))}>
                <option value="">-- Chọn loại --</option>
                {customerTypesByChannel(form.sales_channel).map(t => <option key={t.id} value={t.value}>{t.value}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Phân khúc</label>
              <select className="input" value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}>
                <option value="">-- Chọn phân khúc --</option>
                {segmentsByChannel(form.sales_channel).map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Hệ thống / Chuỗi</label>
              <select className="input" value={form.chain_system} onChange={e => setForm(f => ({ ...f, chain_system: e.target.value }))}>
                <option value="">-- Chọn hệ thống --</option>
                {systemsByChannel(form.sales_channel).map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nguồn</label>
              <select className="input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <option value="">-- Chọn nguồn --</option>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mức độ tiềm năng</label>
              <select className="input" value={form.potential_level} onChange={e => setForm(f => ({ ...f, potential_level: e.target.value }))}>
                <option value="">-- Chọn --</option>
                {POTENTIAL_LEVELS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Trạng thái</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {CUSTOMER_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {canManage && (
              <>
                <div>
                  <label className="label">Sale phụ trách</label>
                  <select className="input" value={form.assigned_sale_id} onChange={e => setForm(f => ({ ...f, assigned_sale_id: e.target.value }))}>
                    <option value="">-- Chọn sale --</option>
                    {sales.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Khu vực</label>
                  <select className="input" value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))}>
                    <option value="">-- Chọn khu vực --</option>
                    {areas.map(a => <option key={a.area_id} value={a.area_id}>{a.area_name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
          <div>
            <label className="label">Địa chỉ</label>
            <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Số nhà, tên đường..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Tỉnh/TP</label><input className="input" value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} /></div>
            <div><label className="label">Quận/Huyện</label><input className="input" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} /></div>
            <div><label className="label">Phường/Xã</label><input className="input" value={form.ward} onChange={e => setForm(f => ({ ...f, ward: e.target.value }))} /></div>
          </div>
          <div>
            <label className="label">Ghi chú</label>
            <textarea className="input" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Ghi chú thêm..." />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={mutCreate.isPending || mutUpdate.isPending} className="btn-primary">
              {(mutCreate.isPending || mutUpdate.isPending) ? 'Đang lưu...' : editing ? '💾 Lưu thay đổi' : '+ Thêm khách hàng'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => mutDelete.mutate(deleteId)}
        loading={mutDelete.isPending}
        title="Xóa khách hàng"
        message="Bạn có chắc chắn muốn xóa khách hàng này? Toàn bộ lịch sử cuộc gọi và follow-up sẽ bị xóa theo."
      />
      <ConfirmDialog
        open={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        onConfirm={() => mutBulkDelete.mutate()}
        loading={mutBulkDelete.isPending}
        title={`Xóa ${selectedIds.length} khách hàng`}
        message={`Bạn có chắc muốn xóa ${selectedIds.length} khách hàng đã chọn? Toàn bộ lịch sử cuộc gọi và follow-up sẽ bị xóa theo.`}
      />

      {/* Import result modal */}
      <Modal open={modal === 'import-result'} onClose={() => setModal(null)} title="📊 Kết quả Import" size="lg">
        {importResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                <div className="text-sm text-green-700">Import thành công</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{importResult.errors?.length || 0}</div>
                <div className="text-sm text-red-700">Bị lỗi / bỏ qua</div>
              </div>
            </div>
            {importResult.errors?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Chi tiết lỗi:</p>
                <div className="max-h-60 overflow-y-auto border border-red-100 rounded-lg divide-y divide-red-50">
                  {importResult.errors.map((e, i) => (
                    <div key={i} className="px-3 py-2 text-sm flex justify-between">
                      <span className="text-gray-500">Dòng {e.row}</span>
                      <span className="text-red-600">{e.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setModal(null)} className="btn-primary">Đóng</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
