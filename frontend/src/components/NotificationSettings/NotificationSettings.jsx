import { useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import styles from './NotificationSettings.module.scss';

function to12Hour(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function parseTime(time24) {
  const [h, m] = time24.split(':').map(Number);
  return { hour: h % 12 || 12, minute: m, period: h >= 12 ? 'PM' : 'AM' };
}

function buildTime24(hour, minute, period) {
  let h = Number(hour) % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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

  const parsed = parseTime(localTime);

  return (
    <div className={`ht-card p-5 mb-6 ${styles.card}`}>
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
          <span className="text-sm text-text-secondary">Remind me at</span>
          <div className={styles.timeSelects}>
            {/* Hour */}
            <Select
              value={String(parsed.hour)}
              onValueChange={(v) => {
                const t = buildTime24(v, parsed.minute, parsed.period);
                setLocalTime(t);
                updateTime(t);
              }}
            >
              <SelectTrigger className="w-[72px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className={styles.timeSep}>:</span>
            {/* Minute */}
            <Select
              value={String(parsed.minute)}
              onValueChange={(v) => {
                const t = buildTime24(parsed.hour, v, parsed.period);
                setLocalTime(t);
                updateTime(t);
              }}
            >
              <SelectTrigger className="w-[72px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <SelectItem key={m} value={String(m)}>{String(m).padStart(2, '0')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* AM/PM */}
            <Select
              value={parsed.period}
              onValueChange={(v) => {
                const t = buildTime24(parsed.hour, parsed.minute, v);
                setLocalTime(t);
                updateTime(t);
              }}
            >
              <SelectTrigger className="w-[76px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          ✅ Push notification received! If you don't see it, make sure notifications are enabled in your browser and device settings.
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
