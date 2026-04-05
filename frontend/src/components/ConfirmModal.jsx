import { dateFormatters } from '../utils/dates';

export default function ConfirmModal({ isOpen, date, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div
      className="ht-backdrop"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="ht-dialog" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-col">
          <h5 className="font-semibold text-text-primary">Override Entry?</h5>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-text-secondary hover:text-text-primary text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 text-sm text-text-primary">
          You already logged a response for{' '}
          <strong>{date ? dateFormatters.display(date) : 'this date'}</strong>.
          Are you sure you want to override it?
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-col">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border-col text-text-secondary text-sm font-medium hover:bg-bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-ht-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Yes, override
          </button>
        </div>
      </div>
    </div>
  );
}
