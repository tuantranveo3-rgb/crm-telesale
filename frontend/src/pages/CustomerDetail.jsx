import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { customersApi, callLogsApi, followUpsApi, pipelineApi } from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import { STATUS_COLORS, CALL_RESULT_COLORS, FOLLOW_STATUS_COLORS, POTENTIAL_COLORS, STAGE_COLORS,
  CALL_RESULTS, NEXT_ACTIONS, FOLLOW_UP_TYPES, PIPELINE_STAGES, CUSTOMER_STATUSES,
  formatDate, formatDateTime, formatCurrency } from '../utils/constants';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [callModal, setCallModal] = useState(false);
  const [fuModal, setFuModal] = useState(false);
  const [oppModal, setOppModal] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');

  const [callForm, setCallForm] = useState({ call_date: new Date().toISOString().split('T')[0], call_time: '', call_result: '', call_content: '', customer_need: '', interest_level: '', next_action: '', follow_up_date: '', status_after_call: '' });
  const [fuForm, setFuForm] = useState({ follow_up_date: '', follow_up_type: 'Gọi điện', content: '' });
  const [oppForm, setOppForm] = useState({ stage: 'Lead mới', estimated_value: '', expected_close_date: '', probability: 50, note: '' });

  const { data: customer, isLoading } = useQuery({ queryKey: ['customer', id], queryFn: () => customersApi.get(id) });
  const mutCall = useMutation({ mutationFn: callLogsApi.create, onSuccess: () => { toast.success('Đã nhập cuộc gọi'); qc.invalidateQueries(['customer', id]); setCallModal(false); } });
  const mutFu = useMutation({ mutationFn: followUpsApi.create, onSuccess: () => { toast.success('Đã tạo follow-up'); qc.invalidateQueries(['customer', id]); setFuModal(false); } });
  const mutOpp = useMutation({ mutationFn: pipelineApi.create, onSuccess: () => { toast.success('Đã tạo cơ hội'); qc.invalidateQueries(['customer', id]); setOppModal(false); } });
  const mutFuUpdate = useMutation({ mutationFn: ({ fuId, data }) => followUpsApi.update(fuId, data), onSuccess: () => { toast.success('Đã cập nhật'); qc.invalidateQueries(['customer', id]); } });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!customer) return <div className="text-center py-20 text-gray-400">Không tìm thấy khách hàng</div>;

  const c = customer;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm">← Quay lại</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{c.customer_name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{c.customer_code}</span>
            <span className={STATUS_COLORS[c.status] || 'badge-gray'}>{c.status}</span>
            {c.potential_level && <span className={POTENTIAL_COLORS[c.potential_level]}>{c.potential_level}</span>}
            {c.customer_type && <span className="badge-teal">{c.customer_type}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`tel:${c.phone}`} className="btn-primary btn-sm">📞 Gọi</a>
          <button onClick={() => setCallModal(true)} className="btn-secondary btn-sm">📝 Nhập cuộc gọi</button>
          <button onClick={() => setFuModal(true)} className="btn-secondary btn-sm">🔔 Follow-up</button>
          <button onClick={() => setOppModal(true)} className="btn-secondary btn-sm">💼 Cơ hội</button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">📋 Thông tin liên hệ</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2"><dt className="text-gray-400 w-20">SĐT:</dt><dd><a href={`tel:${c.phone}`} className="text-primary-600 font-medium">{c.phone}</a></dd></div>
            {c.zalo && <div className="flex gap-2"><dt className="text-gray-400 w-20">Zalo:</dt><dd className="text-blue-600">{c.zalo}</dd></div>}
            {c.address && <div className="flex gap-2"><dt className="text-gray-400 w-20">Địa chỉ:</dt><dd className="text-gray-700">{[c.address, c.ward, c.district, c.province].filter(Boolean).join(', ')}</dd></div>}
          </dl>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">📊 Phân loại</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2"><dt className="text-gray-400 w-20">Loại KH:</dt><dd className="badge-teal badge">{c.customer_type || '—'}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-20">Nguồn:</dt><dd className="text-gray-700">{c.source || '—'}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-20">Khu vực:</dt><dd className="text-gray-700">{c.area_name || '—'}</dd></div>
          </dl>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">👤 Sale phụ trách</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2"><dt className="text-gray-400 w-20">Sale:</dt><dd className="font-medium text-gray-700">{c.sale_name || '—'}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-20">Tạo lúc:</dt><dd className="text-gray-500 text-xs">{formatDateTime(c.created_at)}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-20">Cập nhật:</dt><dd className="text-gray-500 text-xs">{formatDateTime(c.updated_at)}</dd></div>
          </dl>
          {c.note && <div className="mt-3 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-800">📝 {c.note}</div>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[{ key: 'timeline', label: '⏱ Timeline' }, { key: 'calls', label: '📞 Cuộc gọi' }, { key: 'followups', label: '🔔 Follow-up' }, { key: 'opportunities', label: '💼 Pipeline' }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'timeline' && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {!c.timeline?.length ? <p className="text-gray-400 text-sm text-center py-8">Chưa có hoạt động nào</p> : c.timeline.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${item.type === 'call' ? 'bg-primary-100' : item.type === 'followup' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                      {item.type === 'call' ? '📞' : item.type === 'followup' ? '🔔' : '💼'}
                    </div>
                    {i < c.timeline.length - 1 && <div className="w-0.5 h-full bg-gray-200 mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-800">{item.title}</span>
                      {item.status && <span className={`${FOLLOW_STATUS_COLORS[item.status] || 'badge-gray'} badge`}>{item.status}</span>}
                      {item.call_result_color && <span className={`${CALL_RESULT_COLORS[item.title] || 'badge-gray'} badge`}>{item.title}</span>}
                      <span className="text-xs text-gray-400 ml-auto">{formatDate(item.date)} {item.time || ''}</span>
                    </div>
                    {item.content && <p className="text-sm text-gray-600 mt-0.5">{item.content}</p>}
                    {item.estimated_value > 0 && <p className="text-xs text-primary-600 mt-0.5">💰 {formatCurrency(item.estimated_value)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'calls' && (
            <div className="space-y-2">
              {!c.timeline?.filter(t => t.type === 'call').length ? <p className="text-gray-400 text-sm text-center py-8">Chưa có cuộc gọi nào</p>
                : c.timeline.filter(t => t.type === 'call').map((call, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">📞</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`${CALL_RESULT_COLORS[call.title] || 'badge-gray'} badge`}>{call.title}</span>
                        <span className="text-xs text-gray-400">{formatDate(call.date)} {call.time}</span>
                      </div>
                      {call.content && <p className="text-sm text-gray-700 mt-1">{call.content}</p>}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {activeTab === 'followups' && (
            <div className="space-y-2">
              {!c.timeline?.filter(t => t.type === 'followup').length ? <p className="text-gray-400 text-sm text-center py-8">Chưa có follow-up nào</p>
                : c.timeline.filter(t => t.type === 'followup').map((fu, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">🔔</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{fu.title}</span>
                        <span className={`${FOLLOW_STATUS_COLORS[fu.status] || 'badge-gray'} badge`}>{fu.status}</span>
                        <span className="text-xs text-gray-400">{formatDate(fu.date)}</span>
                      </div>
                      {fu.content && <p className="text-sm text-gray-600 mt-1">{fu.content}</p>}
                    </div>
                    {fu.status === 'Chưa xử lý' && (
                      <button onClick={() => mutFuUpdate.mutate({ fuId: fu.id, data: { status: 'Đã xử lý' } })}
                        className="btn-secondary btn-sm text-xs">✓ Xong</button>
                    )}
                  </div>
                ))}
            </div>
          )}

          {activeTab === 'opportunities' && (
            <div className="space-y-2">
              {!c.timeline?.filter(t => t.type === 'opportunity').length ? <p className="text-gray-400 text-sm text-center py-8">Chưa có cơ hội nào</p>
                : c.timeline.filter(t => t.type === 'opportunity').map((opp, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">💼</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`badge text-xs ${STAGE_COLORS[opp.title] || 'badge-gray'}`}>{opp.title}</span>
                        {opp.estimated_value > 0 && <span className="text-sm font-medium text-primary-600">{formatCurrency(opp.estimated_value)}</span>}
                      </div>
                      {opp.content && <p className="text-sm text-gray-600 mt-1">{opp.content}</p>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Call Modal */}
      <Modal open={callModal} onClose={() => setCallModal(false)} title="📞 Nhập kết quả cuộc gọi" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); mutCall.mutate({ ...callForm, customer_id: id }); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Ngày gọi *</label><input type="date" className="input" required value={callForm.call_date} onChange={e => setCallForm(f => ({ ...f, call_date: e.target.value }))} /></div>
            <div><label className="label">Giờ gọi</label><input type="time" className="input" value={callForm.call_time} onChange={e => setCallForm(f => ({ ...f, call_time: e.target.value }))} /></div>
            <div>
              <label className="label">Kết quả cuộc gọi *</label>
              <select className="input" required value={callForm.call_result} onChange={e => setCallForm(f => ({ ...f, call_result: e.target.value }))}>
                <option value="">-- Chọn kết quả --</option>
                {CALL_RESULTS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Hành động tiếp theo</label>
              <select className="input" value={callForm.next_action} onChange={e => setCallForm(f => ({ ...f, next_action: e.target.value }))}>
                <option value="">-- Chọn --</option>
                {NEXT_ACTIONS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Trạng thái KH sau gọi</label>
              <select className="input" value={callForm.status_after_call} onChange={e => setCallForm(f => ({ ...f, status_after_call: e.target.value }))}>
                <option value="">-- Không đổi --</option>
                {CUSTOMER_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ngày follow-up</label>
              <input type="date" className="input" value={callForm.follow_up_date} onChange={e => setCallForm(f => ({ ...f, follow_up_date: e.target.value }))} />
            </div>
          </div>
          <div><label className="label">Nội dung cuộc gọi</label><textarea className="input" rows={2} value={callForm.call_content} onChange={e => setCallForm(f => ({ ...f, call_content: e.target.value }))} placeholder="Ghi lại nội dung trao đổi..." /></div>
          <div><label className="label">Nhu cầu khách hàng</label><input className="input" value={callForm.customer_need} onChange={e => setCallForm(f => ({ ...f, customer_need: e.target.value }))} placeholder="Khách hàng cần gì..." /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setCallModal(false)} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={mutCall.isPending} className="btn-primary">
              {mutCall.isPending ? 'Đang lưu...' : '💾 Lưu cuộc gọi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Follow-up Modal */}
      <Modal open={fuModal} onClose={() => setFuModal(false)} title="🔔 Tạo lịch Follow-up" size="md">
        <form onSubmit={(e) => { e.preventDefault(); mutFu.mutate({ ...fuForm, customer_id: id }); }} className="space-y-4">
          <div><label className="label">Ngày follow-up *</label><input type="date" className="input" required value={fuForm.follow_up_date} onChange={e => setFuForm(f => ({ ...f, follow_up_date: e.target.value }))} /></div>
          <div>
            <label className="label">Hình thức</label>
            <select className="input" value={fuForm.follow_up_type} onChange={e => setFuForm(f => ({ ...f, follow_up_type: e.target.value }))}>
              {FOLLOW_UP_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="label">Nội dung</label><textarea className="input" rows={3} value={fuForm.content} onChange={e => setFuForm(f => ({ ...f, content: e.target.value }))} placeholder="Mô tả việc cần làm..." /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setFuModal(false)} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={mutFu.isPending} className="btn-primary">{mutFu.isPending ? 'Đang lưu...' : '💾 Tạo lịch'}</button>
          </div>
        </form>
      </Modal>

      {/* Opportunity Modal */}
      <Modal open={oppModal} onClose={() => setOppModal(false)} title="💼 Thêm cơ hội bán hàng" size="md">
        <form onSubmit={(e) => { e.preventDefault(); mutOpp.mutate({ ...oppForm, customer_id: id }); }} className="space-y-4">
          <div>
            <label className="label">Giai đoạn</label>
            <select className="input" value={oppForm.stage} onChange={e => setOppForm(f => ({ ...f, stage: e.target.value }))}>
              {PIPELINE_STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="label">Giá trị ước tính (VNĐ)</label><input type="number" className="input" value={oppForm.estimated_value} onChange={e => setOppForm(f => ({ ...f, estimated_value: e.target.value }))} placeholder="5000000" /></div>
          <div><label className="label">Dự kiến chốt</label><input type="date" className="input" value={oppForm.expected_close_date} onChange={e => setOppForm(f => ({ ...f, expected_close_date: e.target.value }))} /></div>
          <div><label className="label">Xác suất thành công (%)</label><input type="number" min="0" max="100" className="input" value={oppForm.probability} onChange={e => setOppForm(f => ({ ...f, probability: e.target.value }))} /></div>
          <div><label className="label">Ghi chú</label><textarea className="input" rows={2} value={oppForm.note} onChange={e => setOppForm(f => ({ ...f, note: e.target.value }))} /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setOppModal(false)} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={mutOpp.isPending} className="btn-primary">{mutOpp.isPending ? 'Đang lưu...' : '💾 Tạo cơ hội'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
