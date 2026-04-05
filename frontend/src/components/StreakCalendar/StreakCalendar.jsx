import { useMemo, useState } from 'react';
import { getDateKey, dateFormatters } from '../../utils/dates';
import styles from './StreakCalendar.module.scss';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StreakCalendar({ habitData }) {
  const [infoText, setInfoText] = useState('');

  // Build a 5-week grid (5 rows × 7 cols), starting from the Sunday
  // 4 weeks before the current week's Sunday.
  const { grid, todayKey } = useMemo(() => {
    const today = new Date();
    const todayKey = getDateKey(today);

    // Find Sunday of the current week
    const startOfCurrentWeek = new Date(today);
    startOfCurrentWeek.setDate(today.getDate() - today.getDay());
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    // Go back 4 more weeks
    const startDate = new Date(startOfCurrentWeek);
    startDate.setDate(startDate.getDate() - 28);

    // Build 5 rows × 7 cols = 35 cells
    const grid = [];
    for (let row = 0; row < 5; row++) {
      const week = [];
      for (let col = 0; col < 7; col++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + row * 7 + col);
        const key = getDateKey(d);
        // Cells beyond today are empty placeholders
        if (d > today) {
          week.push(null);
        } else {
          week.push({
            key,
            dayNum: d.getDate(),
            // null = today not yet logged; 'yes'/'no' = explicitly recorded
            response: habitData[key] ?? null,
            isToday: key === todayKey,
            display: dateFormatters.display(d),
          });
        }
      }
      grid.push(week);
    }

    return { grid, todayKey };
  }, [habitData]);

  const responseClass = (r, isToday) => {
    if (r === 'yes') return styles.yes;
    if (r === 'no') return styles.no;
    // r === null: today not yet logged, or a past cell with no entry
    return isToday ? styles.todayUnlogged : styles.no;
  };

  const cellLabel = (r, isToday) => {
    if (r === 'yes') return '✅ Logged';
    if (r === 'no') return '❌ Missed';
    return isToday ? '⏳ Not logged yet' : '❌ Missed';
  };

  return (
    <div>
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <span key={d} className={styles.dayLabel}>
            {d}
          </span>
        ))}
      </div>

      {/* 5-week grid */}
      <div className="flex flex-col gap-1">
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((cell, ci) =>
              cell === null ? (
                <div key={ci} className={styles.empty} />
              ) : (
                <div
                  key={cell.key}
                  className={`${styles.day} ${responseClass(cell.response, cell.isToday)} ${cell.isToday ? styles.today : ''}`}
                  title={`${cell.display}: ${cellLabel(cell.response, cell.isToday)}`}
                  onMouseEnter={() =>
                    setInfoText(`${cell.display} — ${cellLabel(cell.response, cell.isToday)}`)
                  }
                  onMouseLeave={() => setInfoText('')}
                  onClick={() =>
                    setInfoText(`${cell.display} — ${cellLabel(cell.response, cell.isToday)}`)
                  }
                >
                  {cell.dayNum}
                </div>
              ),
            )}
          </div>
        ))}
      </div>

      {/* Tap/hover info bar (useful on mobile) */}
      <p className={styles.infoBar}>{infoText || '\u00A0'}</p>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={`${styles.legendDot} ${styles.today}`} />
        <span>Today</span>
        <div className={`${styles.legendDot} ${styles.yes}`} />
        <span>Yes</span>
        <div className={`${styles.legendDot} ${styles.no}`} />
        <span>No / missed</span>
      </div>
    </div>
  );
}
