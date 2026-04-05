import { useState, useMemo } from 'react';
import { groupByMonth } from '../../utils/stats';
import { dateFormatters, parseStoredDate } from '../../utils/dates';
import styles from './History.module.scss';

function entryBorderClass(response) {
  if (response === 'yes') return styles.yesBorder;
  return styles.noBorder;
}

/** Group { "April 2026": [...] } → { 2026: { "April 2026": [...] } } */
function groupMonthsByYear(monthGroups) {
  const byYear = {};
  Object.keys(monthGroups).forEach((monthKey) => {
    const year = parseInt(monthKey.split(' ').pop(), 10);
    if (!byYear[year]) byYear[year] = {};
    byYear[year][monthKey] = monthGroups[monthKey];
  });
  return byYear;
}

export default function History({ habitData, rawData }) {
  const [hideAutoFilled, setHideAutoFilled] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonthKey = dateFormatters.monthYear(new Date());

  const [expandedYears, setExpandedYears] = useState(() => new Set([currentYear]));
  const [expandedMonths, setExpandedMonths] = useState(() => new Set([currentMonthKey]));

  const allGroups = useMemo(() => groupByMonth(habitData), [habitData]);

  const groups = useMemo(() => {
    if (!hideAutoFilled) return allGroups;
    const filtered = {};
    Object.keys(allGroups).forEach((month) => {
      const entries = allGroups[month].filter(({ key }) => key in rawData);
      if (entries.length > 0) filtered[month] = entries;
    });
    return filtered;
  }, [allGroups, rawData, hideAutoFilled]);

  const byYear = useMemo(() => groupMonthsByYear(groups), [groups]);
  const sortedYears = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  const toggleYear = (year) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleMonth = (month) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  if (Object.keys(allGroups).length === 0) {
    return (
      <div className="rounded-card border border-border-col bg-card-bg p-6 text-center text-text-secondary text-sm">
        No habit data recorded yet. Track your first day above to get started!
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-xl font-semibold text-text-primary">
          Your Habit History
        </h3>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideAutoFilled}
            onChange={(e) => setHideAutoFilled(e.target.checked)}
            className="w-4 h-4 accent-[var(--accent-color)] cursor-pointer"
          />
          Show only logged entries
        </label>
      </div>

      {sortedYears.length === 0 ? (
        <div className="rounded-card border border-border-col bg-card-bg p-6 text-center text-text-secondary text-sm">
          No explicitly logged entries yet. Uncheck the filter to see all entries.
        </div>
      ) : (
        <div className={styles.historyContainer}>
          {sortedYears.map((year) => {
            const yearExpanded = expandedYears.has(year);

            // Sort months newest-first inside each year
            const monthsInYear = Object.keys(byYear[year]).sort((a, b) => {
              const monthOrder = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December',
              ];
              const [ma, ya] = a.split(' ');
              const [mb, yb] = b.split(' ');
              if (ya !== yb) return Number(yb) - Number(ya);
              return monthOrder.indexOf(mb) - monthOrder.indexOf(ma);
            });

            const totalEntries = monthsInYear.reduce(
              (sum, m) => sum + byYear[year][m].length, 0
            );

            return (
              <div key={year} className={styles.yearBlock}>
                <button
                  onClick={() => toggleYear(year)}
                  className={styles.yearHeader}
                  aria-expanded={yearExpanded}
                >
                  <span className={`${styles.chevron} ${yearExpanded ? styles.chevronOpen : ''}`}>▶</span>
                  <span className={styles.yearLabel}>{year}</span>
                  <span className={styles.yearBadge}>
                    {totalEntries} entries · {monthsInYear.length} month{monthsInYear.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {yearExpanded && (
                  <div className={styles.monthsContainer}>
                    {monthsInYear.map((monthKey) => {
                      const monthExpanded = expandedMonths.has(monthKey);
                      const entries = byYear[year][monthKey];
                      const yesCount = entries.filter((e) => e.response === 'yes').length;

                      return (
                        <div key={monthKey} className={styles.monthBlock}>
                          <button
                            onClick={() => toggleMonth(monthKey)}
                            className={styles.monthHeader}
                            aria-expanded={monthExpanded}
                          >
                            <span className={`${styles.chevron} ${monthExpanded ? styles.chevronOpen : ''}`}>▶</span>
                            <span className={styles.monthName}>{monthKey.split(' ')[0]}</span>
                            <span className={styles.monthBadge}>
                              {yesCount}/{entries.length} days ✅
                            </span>
                          </button>

                          {monthExpanded && (
                            <div className={styles.entriesGrid}>
                              {entries
                                .slice()
                                .reverse()
                                .map(({ key, response }) => (
                                  <div
                                    key={key}
                                    className={`${styles.entryCard} ${entryBorderClass(response)}`}
                                  >
                                    <span className={styles.dateText}>
                                      {dateFormatters.short(parseStoredDate(key))}
                                    </span>
                                    <span>{response === 'yes' ? '✅' : '❌'}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
