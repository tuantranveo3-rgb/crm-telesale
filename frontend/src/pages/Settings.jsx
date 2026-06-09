import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { settingsApi } from '../api';

const CATEGORIES = [
  {
    group: '📦 Khách hàng',
    items: [
      { key: 'sales_channel', label: 'Kênh bán hàng', hasParent: false, parentCategory: null },
      { key: 'customer_type', label: 'Loại khách hàng', hasParent: true, parentCategory: 'sales_channel', parentLabel: 'Kênh BH' },
      { key: 'segment', label: 'Phân khúc', hasParent: true, parentCategory: 'sales_channel', parentLabel: 'Kênh BH' },
      { key: 'chain_system', label: 'Hệ thống / Chuỗi', hasParent: true, parentCategory: 'sales_channel', parentLabel: 'Kênh BH' },
    ],
  },
  {
    group: '📞 Cuộc gọi',
    items: [
      { key: 'call_method', label: 'Hình thức liên hệ', hasParent: false, parentCategory: null },
      { key: 'call_status', label: 'Trạng thái xử lý', hasParent: false, parentCategory: null },
      { key: 'call_result', label: 'Kết quả cuộc gọi', hasParent: false, parentCategory: null },
      { key: 'next_action', label: 'Hành động tiếp theo', hasParent: false, parentCategory: null },
    ],
  },
  {
    group: '🔔 Follow-up',
    items: [
      { key: 'follow_up_type', label: 'Hình thức follow-up', hasParent: false, parentCategory: null },
    ],
  },
];

export default function Settings() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('sales_channel');
  const [newValue, setNewValue] = useState('');
  const [newParent, setNewParent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const { data } = useQuery({ queryKey: ['lookups-admin'], queryFn: settingsApi.getLookups });
  const grouped = data?.grouped || {};

  const catInfo = CATEGORIES.flatMap(g => g.items).find(c => c.key === activeCategory);
  const rows = grouped[activeCategory] || [];
  const parentOptions = catInfo?.parentCategory ? (grouped[catInfo.parentCategory] || []) : [];

  const mutCreate = useMutation({
    mutationFn: settingsApi.createLookup,
    onSuccess: () => { toast.success('Đã thêm'); qc.invalidateQueries(['lookups-admin']); qc.invalidateQueries(['lookups']); setNewValue(''); setNewParent(''); },
    onError: (e) => toast.error(e.message || 'Lỗi'),
  });
  const mutUpdate = useMutation({
    mutationFn: ({ id, data }) => settingsApi.updateLookup(id, data),
    onSuccess: () => { toast.success('Đã cập nhật'); qc.invalidateQueries(['lookups-admin']); qc.invalidateQueries(['lookups']); setEditingId(null); },
  });
  const mutDelete = useMutation({
    mutationFn: settingsApi.deleteLookup,
    onSuccess: () => { toast.success('Đã xóa'); qc.invalidateQueries(['lookups-admin']); qc.invalidateQueries(['lookups']); },
  });
  const mutToggle = useMutation({
    mutationFn: ({ id, is_active }) => settingsApi.updateLookup(id, { is_active }),
    onSuccess: () => { qc.invalidateQueries(['lookups-admin']); qc.invalidateQueries(['lookups']); },
  });

  const handleAdd = () => {
    if (!newValue.trim()) return toast.error('Nhập giá trị trước');
    if (catInfo?.hasParent && !newParent) return toast.error('Chọn ' + catInfo.parentLabel);
    mutCreate.mutate({ category: activeCategory, parent_value: newParent || null, value: newValue.trim(), sort_order: rows.length + 1 });
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">⚙️ Cài đặt danh mục</h1>
        <p className="text-sm text-gray-500">Quản lý các giá trị dropdown trong hệ thống</p>
      </div>

      <div className="flex gap-4">
        {/* Sidebar menu */}
        <div className="w-56 flex-shrink-0 space-y-1">
          {CATEGORIES.map(group => (
            <div key={group.group}>
              <div className="text-xs font-semibold text-gray-400 uppercase px-3 py-2">{group.group}</div>
              {group.items.map(item => (
                <button key={item.key} onClick={() => { setActiveCategory(item.key); setNewValue(''); setNewParent(''); setEditingId(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === item.key ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                  {item.label}
                  <span className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${activeCategory === item.key ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {(grouped[item.key] || []).filter(r => r.is_active).length}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">{catInfo?.label}</h2>
            {catInfo?.hasParent && <p className="text-xs text-gray-500">Lọc theo {catInfo.parentLabel} để thêm giá trị</p>}
          </div>

          {/* Add form */}
          <div className="flex gap-2 p-3 bg-gray-50 rounded-lg">
            {catInfo?.hasParent && (
              <select className="input w-40 flex-shrink-0" value={newParent} onChange={e => setNewParent(e.target.value)}>
                <option value="">-- {catInfo.parentLabel} --</option>
                {parentOptions.map(p => <option key={p.id} value={p.value}>{p.value}</option>)}
              </select>
            )}
            <input className="input flex-1" placeholder={`Thêm ${catInfo?.label}...`} value={newValue}
              onChange={e => setNewValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <button onClick={handleAdd} disabled={mutCreate.isPending} className="btn-primary btn-sm whitespace-nowrap">
              + Thêm
            </button>
          </div>

          {/* Table */}
          <div className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Chưa có dữ liệu. Thêm giá trị bên trên.</div>
            ) : rows.map(row => (
              <div key={row.id} className={`flex items-center gap-3 py-2.5 px-1 ${!row.is_active ? 'opacity-40' : ''}`}>
                {catInfo?.hasParent && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full w-28 text-center truncate flex-shrink-0">
                    {row.parent_value || '—'}
                  </span>
                )}
                {editingId === row.id ? (
                  <input className="input flex-1 py-1" value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') mutUpdate.mutate({ id: row.id, data: { value: editValue } }); if (e.key === 'Escape') setEditingId(null); }}
                    autoFocus />
                ) : (
                  <span className="flex-1 text-sm text-gray-700">{row.value}</span>
                )}
                <div className="flex gap-1 flex-shrink-0">
                  {editingId === row.id ? (
                    <>
                      <button onClick={() => mutUpdate.mutate({ id: row.id, data: { value: editValue } })} className="btn-primary btn-sm px-2 py-1 text-xs">✓</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary btn-sm px-2 py-1 text-xs">✕</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(row.id); setEditValue(row.value); }} className="btn-secondary btn-sm px-2 py-1 text-xs">✏️</button>
                      <button onClick={() => mutToggle.mutate({ id: row.id, is_active: row.is_active ? 0 : 1 })}
                        className={`btn-sm px-2 py-1 text-xs ${row.is_active ? 'btn-secondary' : 'btn-primary'}`}
                        title={row.is_active ? 'Ẩn' : 'Hiện'}>
                        {row.is_active ? '👁' : '🙈'}
                      </button>
                      <button onClick={() => { if (confirm(`Xóa "${row.value}"?`)) mutDelete.mutate(row.id); }}
                        className="btn-danger btn-sm px-2 py-1 text-xs">🗑</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
