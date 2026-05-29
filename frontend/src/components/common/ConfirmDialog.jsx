import Modal from './Modal';

export default function ConfirmDialog({ open, onClose, onConfirm, title = 'Xác nhận', message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Hủy</button>
        <button onClick={onConfirm} disabled={loading} className="btn-danger">
          {loading ? 'Đang xử lý...' : 'Xác nhận'}
        </button>
      </div>
    </Modal>
  );
}
