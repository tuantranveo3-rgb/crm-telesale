export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = pagination;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <div className="text-sm text-gray-500">
        Hiển thị {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total} kết quả
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
        >‹</button>
        {start > 1 && <><button onClick={() => onPageChange(1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">1</button><span className="text-gray-400">…</span></>}
        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`px-3 py-1.5 text-sm border rounded-lg ${p === page ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 hover:bg-gray-50'}`}>
            {p}
          </button>
        ))}
        {end < totalPages && <><span className="text-gray-400">…</span><button onClick={() => onPageChange(totalPages)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">{totalPages}</button></>}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
        >›</button>
      </div>
    </div>
  );
}
