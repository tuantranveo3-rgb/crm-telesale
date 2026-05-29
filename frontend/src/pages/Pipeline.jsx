import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { pipelineApi, usersApi, areasApi } from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { PIPELINE_STAGES, STAGE_COLORS, formatCurrency, formatDate } from '../utils/constants';

export default function Pipeline() {
  const { canManage, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ sale_id: '', area_id: '' });
  const [editOpp, setEditOpp] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const { data, isLoading } = useQuery({ queryKey: ['pipeline', filters], queryFn: () => pipelineApi.list(filters) });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: canManage });
  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: areasApi.list, enabled: isAdmin });

  const mutUpdate = useMutation({
    mutationFn: ({ id, data }) => pipelineApi.update(id, data),
    onSuccess: () => { toast.success('Đã cập nhật'); qc.invalidateQueries(['pipeline']); setEditOpp(null); }
  });
  const mutDelete = useMutation({
    mutationFn: pipelineApi.delete,
    onSuccess: () => { toast.success('Đã xóa'); qc.invalidateQueries(['pipeline']); setDeleteId(null); }
  });

  const openEdit = (opp) => { setEditOpp(opp); setEditForm({ stage: opp.stage, estimated_value: opp.estimated_value, expected_close_date: opp.expected_close_date || '', probability: opp.probability, note: opp.note || '' }); };

  const pipeline = data?.pipeline || {};
  const totalValue = data?.totalValue || 0;
  const sales = users.filter(u => u.role === 'Sale' || u.role === 'Telesale');

  return (
    <div className="space-y-4">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">💼 Pipeline bán hàng</h1>
          <p className="text-sm text-gray-500 mt-1">Tổng giá trị: <span className="font-semibold text-primary-600">{formatCurrency(totalValue)}</span></p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <select className="input w-auto" value={filters.sale_id} onChange={e => setFilters(f => ({ ...f, sale_id: e.target.value }))}>
              <option value="">Tất cả sale</option>
              {sales.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </select>
            {isAdmin && (
              <select className="input w-auto" value={filters.area_id} onChange={e => setFilters(f => ({ ...f, area_id: e.target.value }))}>
                <option value="">Tất cả khu vực</option>
                {areas.map(a => <option key={a.area_id} value={a.area_id}>{a.area_name}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {PIPELINE_STAGES.map(stage => {
              const col = pipeline[stage] || { items: [], total: 0, count: 0 };
              return (
                <div key={stage} className="w-64 flex-shrink-0">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs ${STAGE_COLORS[stage] || 'badge-gray'}`}>{stage}</span>
                      <span className="text-xs text-gray-500 font-medium">{col.count}</span>
                    </div>
                    <span className="text-xs text-gray-400">{formatCurrency(col.total)}</span>
                  </div>

                  <div className="space-y-2 min-h-[100px]">
                    {col.items.map(opp => (
                      <div key={opp.opportunity_id} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                        <Link to={`/customers/${opp.customer_id}`} className="font-medium text-sm text-primary-600 hover:underline block truncate">{opp.customer_name}</Link>
                        <div className="text-xs text-gray-400 mt-0.5">{opp.phone}</div>
                        {opp.estimated_value > 0 && (
                          <div className="mt-2 text-sm font-semibold text-gray-800">{formatCurrency(opp.estimated_value)}</div>
                        )}
                        {opp.probability > 0 && (
                          <div className="mt-1">
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                              <span>Xác suất</span><span>{opp.probability}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${opp.probability}%` }} />
                            </div>
                          </div>
                        )}
                        {opp.expected_close_date && (
                          <div className="mt-2 text-xs text-gray-400">🗓 {formatDate(opp.expected_close_date)}</div>
                        )}
                        {opp.sale_name && <div className="mt-1 text-xs text-gray-400">👤 {opp.sale_name}</div>}
                        {opp.note && <div className="mt-2 text-xs text-gray-500 italic truncate">"{opp.note}"</div>}

                        {/* Stage change buttons */}
                        <div className="mt-3 flex flex-col gap-1">
                          <div className="flex gap-1">
                            {PIPELINE_STAGES.indexOf(stage) > 0 && (
                              <button onClick={() => mutUpdate.mutate({ id: opp.opportunity_id, data: { stage: PIPELINE_STAGES[PIPELINE_STAGES.indexOf(stage) - 1] } })}
                                className="flex-1 text-xs py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg">← Lùi</button>
                            )}
                            {PIPELINE_STAGES.indexOf(stage) < PIPELINE_STAGES.length - 1 && (
                              <button onClick={() => mutUpdate.mutate({ id: opp.opportunity_id, data: { stage: PIPELINE_STAGES[PIPELINE_STAGES.indexOf(stage) + 1] } })}
                                className="flex-1 text-xs py-1 bg-primary-50 hover:bg-primary-100 border border-primary-200 text-primary-700 rounded-lg">Tiến →</button>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(opp)} className="flex-1 text-xs py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg">✏️ Sửa</button>
                            <button onClick={() => setDeleteId(opp.opportunity_id)} className="text-xs py-1 px-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg">🗑</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {col.items.length === 0 && <div className="text-center py-6 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-xl">Trống</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={!!editOpp} onClose={() => setEditOpp(null)} title="Sửa cơ hội" size="md">
        <form onSubmit={(e) => { e.preventDefault(); mutUpdate.mutate({ id: editOpp.opportunity_id, data: editForm }); }} className="space-y-4">
          <div>
            <label className="label">Giai đoạn</label>
            <select className="input" value={editForm.stage} onChange={e => setEditForm(f => ({ ...f, stage: e.target.value }))}>
              {PIPELINE_STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="label">Giá trị (VNĐ)</label><input type="number" className="input" value={editForm.estimated_value} onChange={e => setEditForm(f => ({ ...f, estimated_value: e.target.value }))} /></div>
          <div><label className="label">Dự kiến chốt</label><input type="date" className="input" value={editForm.expected_close_date} onChange={e => setEditForm(f => ({ ...f, expected_close_date: e.target.value }))} /></div>
          <div><label className="label">Xác suất (%)</label><input type="number" min="0" max="100" className="input" value={editForm.probability} onChange={e => setEditForm(f => ({ ...f, probability: e.target.value }))} /></div>
          <div><label className="label">Ghi chú</label><textarea className="input" rows={2} value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setEditOpp(null)} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={mutUpdate.isPending} className="btn-primary">{mutUpdate.isPending ? 'Đang lưu...' : '💾 Lưu'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => mutDelete.mutate(deleteId)}
        loading={mutDelete.isPending} title="Xóa cơ hội" message="Bạn có chắc muốn xóa cơ hội này?" />
    </div>
  );
}
