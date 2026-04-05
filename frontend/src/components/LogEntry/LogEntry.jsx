import { useState, useEffect, useCallback } from 'react';
import { getDateKey, dateFormatters } from '../../utils/dates';
import ConfirmModal from '../ConfirmModal';
import styles from './LogEntry.module.scss';

export default function LogEntry({ habitData, habitName, onLog, isSaving }) {
  const [useManualDate, setUseManualDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pendingOverride, setPendingOverride] = useState(null);
  const [animClass, setAnimClass] = useState('');

  const todayStr = getDateKey(new Date());
  const dateKey = getDateKey(selectedDate);
  const existingEntry = habitData[dateKey];
  // 'yes' or 'no' = already explicitly logged; null/undefined = not yet logged
  const alreadyLogged = existingEntry === 'yes' || existingEntry === 'no';

  // Reset to today when manual date toggle is turned off
  useEffect(() => {
    if (!useManualDate) setSelectedDate(new Date());
  }, [useManualDate]);

  const triggerAnimation = (response) => {
    const cls =
      response === 'yes' ? styles.successAnimation : styles.failureAnimation;
    setAnimClass(cls);
    setTimeout(() => setAnimClass(''), 350);
  };

  const handleLog = useCallback(
    (response) => {
      if (isSaving) return;
      if (alreadyLogged) {
        setPendingOverride({ date: dateKey, response });
      } else {
        onLog({ date: dateKey, response });
        triggerAnimation(response);
      }
    },
    [isSaving, alreadyLogged, dateKey, onLog],
  );

  // Keyboard shortcuts — Y / N
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleLog('yes');
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleLog('no');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleLog]);

  const handleDateInput = (e) => {
    if (e.target.value) setSelectedDate(new Date(e.target.value + 'T00:00:00'));
  };

  const handleConfirm = () => {
    if (pendingOverride) {
      onLog(pendingOverride);
      triggerAnimation(pendingOverride.response);
      setPendingOverride(null);
      // Reset to today after override
      if (useManualDate) {
        setUseManualDate(false);
        setSelectedDate(new Date());
      }
    }
  };

  return (
    <>
      <div className={`${styles.card} ${animClass} ${alreadyLogged ? (existingEntry === 'yes' ? styles.successBorder : styles.failureBorder) : ''}`}>
        {/* Manual date toggle */}
        <div className="flex justify-center mb-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useManualDate}
              onChange={(e) => setUseManualDate(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent-color)] cursor-pointer"
            />
            Log for a different date
          </label>
        </div>

        {useManualDate && (
          <div className="flex flex-col items-center gap-1 mb-4">
            <label className="text-sm text-text-secondary">Select Date:</label>
            <input
              type="date"
              max={todayStr}
              value={getDateKey(selectedDate)}
              onChange={handleDateInput}
              className={styles.dateInput}
            />
          </div>
        )}

        <h4 className="text-lg font-semibold text-center text-text-primary mb-1">
          Did you{' complete your habit '}
          {/* <span className="text-ht-accent">{habitName ?? 'complete your habit'}</span>{' '} */}
          on <strong>{dateFormatters.display(selectedDate)}</strong>?
        </h4>

        {alreadyLogged && (
          <p className="text-center text-sm text-text-secondary mb-2">
            Already logged:{' '}
            <strong>{existingEntry === 'yes' ? '✅ Yes' : '❌ No'}</strong>.
            Clicking again will override.
          </p>
        )}

        {/* Yes / No buttons */}
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={() => handleLog('yes')}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg bg-ht-success text-white font-semibold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isSaving ? '...' : '✅ Yes'}
          </button>
          <button
            onClick={() => handleLog('no')}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg bg-ht-danger text-white font-semibold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isSaving ? '...' : '❌ No'}
          </button>
        </div>

        <div className="flex justify-center mt-4">
          <p className={styles.hint}>
            💡 Press <kbd>Y</kbd> for Yes or <kbd>N</kbd> for No
          </p>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!pendingOverride}
        date={selectedDate}
        onConfirm={handleConfirm}
        onCancel={() => setPendingOverride(null)}
      />
    </>
  );
}
