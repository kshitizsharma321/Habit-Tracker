import { useMemo, useState } from 'react';
import { getDateKey, dateFormatters } from '../../utils/dates';
import { isGoalMet } from '../../utils/stats';
import styles from './StreakCalendar.module.scss';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StreakCalendar({ habitData, definition }) {
  const [infoText, setInfoText] = useState('');
  const hasAnyData = Object.keys(habitData).length > 0;

  const { grid } = useMemo(() => {
    const today = new Date();
    const todayKey = getDateKey(today);

    const startOfCurrentWeek = new Date(today);
    startOfCurrentWeek.setDate(today.getDate() - today.getDay());
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const startDate = new Date(startOfCurrentWeek);
    startDate.setDate(startDate.getDate() - 28);

    const grid = [];
    for (let row = 0; row < 5; row++) {
      const week = [];
      for (let col = 0; col < 7; col++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + row * 7 + col);
        const key = getDateKey(d);
        if (d > today) {
          week.push(null);
        } else {
          week.push({
            key,
            dayNum: d.getDate(),
            value: habitData[key] ?? null,
            isToday: key === todayKey,
            display: dateFormatters.display(d),
          });
        }
      }
      grid.push(week);
    }
    return { grid };
  }, [habitData]);

  // Derive from goal.value presence (not goal.enabled) so a present target always
  // colors quantity cells — fixes quantity heatmaps that didn't reflect entries.
  const goalValue = definition?.trackingType === 'quantity' && definition?.goal?.value
    ? definition.goal.value
    : null;
  const goalDirection = definition?.goal?.direction || 'at_least';

  function getCellStyle(r, isToday) {
    if (r === 'yes') return styles.yes;
    if (r === 'no') return styles.no;
    if (typeof r === 'number') {
      // A logged value that misses the goal is styled 'no' (red) — not 'neutral' —
      // so logged days are visually distinct from empty no-data days.
      if (goalValue != null) return isGoalMet(r, goalValue, goalDirection) ? styles.yes : styles.no;
      return r > 0 ? styles.yes : styles.no;
    }
    if (r === null) return isToday ? styles.todayUnlogged : styles.neutral;
    return styles.neutral;
  }

  function getCellLabel(r, isToday) {
    if (r === 'yes') return '✅ Done';
    if (r === 'no') return '❌ Skipped';
    if (typeof r === 'number') {
      const unit = definition?.unit ? ' ' + definition.unit : '';
      if (goalValue != null) {
        if (goalDirection === 'at_most') {
          return isGoalMet(r, goalValue, 'at_most')
            ? `✅ ${r}${unit} — under limit!`
            : `📊 ${r}${unit} — limit: ${goalValue}`;
        }
        return isGoalMet(r, goalValue, 'at_least')
          ? `✅ ${r}${unit} — goal met!`
          : `📊 ${r}${unit} — target: ${goalValue}`;
      }
      return r > 0 ? `✅ ${r}${unit}` : '❌ 0';
    }
    if (r === null) return isToday ? '⏳ Not logged yet' : 'No data';
    return 'No data';
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <span key={d} className={styles.dayLabel}>{d}</span>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((cell, ci) =>
              cell === null ? (
                <div key={ci} className={styles.empty} />
              ) : (
                <div
                  key={cell.key}
                  className={`${styles.day} ${getCellStyle(cell.value, cell.isToday)} ${cell.isToday ? styles.today : ''}`}
                  title={`${cell.display}: ${getCellLabel(cell.value, cell.isToday)}`}
                  onMouseEnter={() => setInfoText(`${cell.display} — ${getCellLabel(cell.value, cell.isToday)}`)}
                  onMouseLeave={() => setInfoText('')}
                  onClick={() => setInfoText(`${cell.display} — ${getCellLabel(cell.value, cell.isToday)}`)}
                >
                  {cell.dayNum}
                </div>
              ),
            )}
          </div>
        ))}
      </div>

      <p className={styles.infoBar}>{infoText || '\u00A0'}</p>

      <div className={styles.legend}>
        <div className={`${styles.legendDot} ${styles.today}`} />
        <span>Today</span>
        <div className={`${styles.legendDot} ${styles.yes}`} />
        <span>Yes</span>
        <div className={`${styles.legendDot} ${styles.no}`} />
        <span>No</span>
        {!hasAnyData && (
          <>
            <div className={`${styles.legendDot} ${styles.neutral}`} />
            <span>No data</span>
          </>
        )}
      </div>
    </div>
  );
}
