import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usersApi, areasApi } from '../api';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { ROLES, formatDate } from '../utils/constants';

const EMPTY = { full_name: '', email: '', phone: '', password: '', role: 'Sale', area_id: '', status: 'Active' };

export default function Users() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState(null);

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: areasApi.list });

  const mutCreate = useMutation({ mutationFn: usersApi.create, onSuccess: () => { toast.success('Tạo tài khoản thành công'); qc.invalidateQueries(['users']); close(); } });
  const mutUpdate = useMutation({ mutationFn: ({ id, data }) => usersApi.update(id, data), onSuccess: () => { toast.success('Cập nhật thành công'); qc.invalidateQueries(['users']); close(); } });
  const mutDelete = useMutation({ mutationFn: usersApi.delete, onSuccess: () => { toast.success('Đã vô hiệu hóa'); qc.invalidateQueries(['users']); setDeleteId(null); } });

  const close = () => { setModal(null); setEditing(null); setForm(EMPTY); };
  const openEdit = (u) => { setEditing(u); setForm({ full_name: u.full_name, email: u.email, phone: u.phone || '', password: '', role: u.role, area_id: u.area_id || '', status: u.status }); setModal('form'); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) mutUpdate.mutate({ id: editing.user_id, data: form });
    else mutCreate.mutate(form);
  };

  const roleColors = { Admin: 'badge-red', Manager: 'badge-purple', Sale: 'badge-blue', Telesale: 'badge-teal' };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">👤 Quản lý người dùng</h1>
        <button onClick={() => { setForm(EMPTY); setModal('form'); }} className="btn-primary btn-sm">+ Tạo tài khoản</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Họ tên</th><th>Email</th><th>Điện thoại</th><th>Vai trò</th><th>Khu vực</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
              ) : users.map(u => (
                <tr key={u.user_id}>
                  <td className="font-medium text-gray-800">{u.full_name}</td>
                  <td className="text-sm text-gray-600">{u.email}</td>
                  <td className="text-sm text-gray-600">{u.phone || '—'}</td>
                  <td><span className={`badge ${roleColors[u.role] || 'badge-gray'}`}>{u.role}</span></td>
                  <td className="text-sm text-gray-600">{u.area_name || '—'}</td>
                  <td><span className={u.status === 'Active' ? 'badge-green badge' : 'badge-red badge'}>{u.status}</span></td>
                  <td className="text-xs text-gray-400">{formatDate(u.created_at)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="btn-secondary btn-sm px-2 py-1">✏️</button>
                      <button onClick={() => setDeleteId(u.user_id)} className="btn-danger btn-sm px-2 py-1">🚫</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal === 'form'} onClose={close} title={editing ? 'Sửa tài khoản' : 'Tạo tài khoản mới'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Họ và tên *</label><input className="input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
            <div><label className="label">Email *</label><input type="email" className="input" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><label className="label">Số điện thoại</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div>
              <label className="label">Mật khẩu {editing ? '(để trống = giữ nguyên)' : '*'}</label>
              <input type="password" className="input" required={!editing} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Tối thiểu 6 ký tự" />
            </div>
            <div>
              <label className="label">Vai trò *</label>
              <select className="input" required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Khu vực</label>
              <select className="input" value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))}>
                <option value="">-- Chưa gán --</option>
                {areas.map(a => <option key={a.area_id} value={a.area_id}>{a.area_name}</option>)}
              </select>
            </div>
            {editing && (
              <div>
                <label className="label">Trạng thái</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option>Active</option><option>Inactive</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={close} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={mutCreate.isPending || mutUpdate.isPending} className="btn-primary">
              {(mutCreate.isPending || mutUpdate.isPending) ? 'Đang lưu...' : editing ? '💾 Lưu' : '+ Tạo tài khoản'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => mutDelete.mutate(deleteId)}
        loading={mutDelete.isPending} title="Vô hiệu hóa tài khoản" message="Tài khoản này sẽ bị vô hiệu hóa và không thể đăng nhập." />
    </div>
  );
}
