import { useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import styles from './NotificationSettings.module.scss';

function to12Hour(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function NotificationSettings() {
  const {
    isSupported,
    permission,
    isEnabled,
    reminderTime,
    loading,
    error,
    pushReceived,
    enable,
    disable,
    updateTime,
    testPush,
  } = useNotifications();

  const [localTime, setLocalTime] = useState(reminderTime);

  // Don't render anything if the browser doesn't support push notifications
  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isEnabled) {
      await disable();
    } else {
      await enable(localTime);
    }
  };

  const handleTimeChange = (e) => {
    const t = e.target.value;
    setLocalTime(t);
    updateTime(t);
  };

  return (
    <div className={`ht-card p-5 ${styles.card}`}>
      <div className={styles.header}>
        <div>
          <h5 className="font-semibold text-base text-text-primary">🔔 Daily Reminder</h5>
          <p className="text-sm text-text-secondary mt-0.5">
            {isEnabled
              ? `You'll be reminded every day at ${to12Hour(reminderTime)}`
              : 'Get a daily push notification to log your habit'}
          </p>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading || permission === 'denied'}
          className={`${styles.toggle} ${isEnabled ? styles.toggleOn : styles.toggleOff}`}
          aria-label={isEnabled ? 'Disable reminder' : 'Enable reminder'}
        >
          {loading ? (
            <span className={styles.spinner} />
          ) : (
            <span className={styles.thumb} />
          )}
        </button>
      </div>

      {isEnabled && (
        <div className={styles.timePicker}>
          <label className="text-sm text-text-secondary" htmlFor="reminder-time">
            Remind me at
          </label>
          <input
            id="reminder-time"
            type="time"
            value={localTime}
            onChange={handleTimeChange}
            className={styles.timeInput}
          />
          <button
            onClick={testPush}
            disabled={loading}
            className={styles.testBtn}
            title="Send a test notification right now"
          >
            Test now
          </button>
        </div>
      )}

      {pushReceived && (
        <p className={styles.pushReceivedMsg}>
          ✅ Push received by this browser! If no notification appeared, check
          macOS System Settings → Notifications → Google Chrome and make sure
          it's set to <strong>Alerts</strong> or <strong>Banners</strong>.
        </p>
      )}

      {permission === 'denied' && (
        <p className={styles.deniedMsg}>
          ⚠️ Notifications are blocked in your browser. Go to browser settings → Site settings → Notifications and allow this site.
        </p>
      )}

      {error && <p className={styles.errorMsg}>⚠️ {error}</p>}
    </div>
  );
}
