import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { areasApi, usersApi } from '../api';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

const EMPTY = { area_name: '', province: '', district: '', manager_id: '' };

export default function Areas() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState(null);

  const { data: areas = [], isLoading } = useQuery({ queryKey: ['areas'], queryFn: areasApi.list });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const mutCreate = useMutation({ mutationFn: areasApi.create, onSuccess: () => { toast.success('Tạo khu vực thành công'); qc.invalidateQueries(['areas']); close(); } });
  const mutUpdate = useMutation({ mutationFn: ({ id, data }) => areasApi.update(id, data), onSuccess: () => { toast.success('Cập nhật thành công'); qc.invalidateQueries(['areas']); close(); } });
  const mutDelete = useMutation({ mutationFn: areasApi.delete, onSuccess: () => { toast.success('Đã xóa'); qc.invalidateQueries(['areas']); setDeleteId(null); } });

  const close = () => { setModal(false); setEditing(null); setForm(EMPTY); };
  const openEdit = (a) => { setEditing(a); setForm({ area_name: a.area_name, province: a.province || '', district: a.district || '', manager_id: a.manager_id || '' }); setModal(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) mutUpdate.mutate({ id: editing.area_id, data: form });
    else mutCreate.mutate(form);
  };

  const managers = users.filter(u => u.role === 'Manager' || u.role === 'Admin');

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">🗺️ Quản lý khu vực</h1>
        <button onClick={() => { setForm(EMPTY); setModal(true); }} className="btn-primary btn-sm">+ Thêm khu vực</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="text-gray-400 text-center py-10 col-span-3">Đang tải...</div>
        ) : areas.map(area => (
          <div key={area.area_id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 text-base">{area.area_name}</h3>
                {area.province && <p className="text-sm text-gray-500 mt-0.5">📍 {area.province}</p>}
                {area.district && <p className="text-xs text-gray-400">{area.district}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(area)} className="btn-secondary btn-sm px-2 py-1">✏️</button>
                <button onClick={() => setDeleteId(area.area_id)} className="btn-danger btn-sm px-2 py-1">🗑</button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-gray-400 text-xs">Manager</div>
                <div className="font-medium text-gray-700">{area.manager_name || '—'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Số sale</div>
                <div className="font-medium text-gray-700">{area.sale_count || 0} người</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={close} title={editing ? 'Sửa khu vực' : 'Thêm khu vực'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Tên khu vực *</label><input className="input" required value={form.area_name} onChange={e => setForm(f => ({ ...f, area_name: e.target.value }))} placeholder="Khu vực HCM..." /></div>
          <div><label className="label">Tỉnh/Thành phố</label><input className="input" value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} /></div>
          <div><label className="label">Quận/Huyện phụ trách</label><input className="input" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder="Quận 1, 3, 5..." /></div>
          <div>
            <label className="label">Manager phụ trách</label>
            <select className="input" value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}>
              <option value="">-- Chưa chọn --</option>
              {managers.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.role})</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={close} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={mutCreate.isPending || mutUpdate.isPending} className="btn-primary">
              {(mutCreate.isPending || mutUpdate.isPending) ? 'Đang lưu...' : editing ? '💾 Lưu' : '+ Thêm'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => mutDelete.mutate(deleteId)}
        loading={mutDelete.isPending} title="Xóa khu vực" message="Xóa khu vực này? Các user và khách hàng thuộc khu vực sẽ không bị xóa." />
    </div>
  );
}
