import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { getDateKey, parseStoredDate } from '../../utils/dates';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function DatePicker({ value, onChange, maxDate }) {
  const todayStr = getDateKey(new Date());
  const resolvedMax = maxDate || todayStr;

  const initDate = value ? parseStoredDate(value) : new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function padded(n) { return String(n).padStart(2, '0'); }
  function cellDateStr(day) {
    return `${viewYear}-${padded(viewMonth + 1)}-${padded(day)}`;
  }

  function canGoNext() {
    const now = new Date();
    return viewYear < now.getFullYear() || (viewYear === now.getFullYear() && viewMonth < now.getMonth());
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (!canGoNext()) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function handleSelect(day) {
    const ds = cellDateStr(day);
    if (ds > resolvedMax) return;
    onChange(ds);
    setOpen(false);
  }

  const displayLabel = value
    ? parseStoredDate(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Pick a date';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs font-normal"
          style={{ color: value ? 'var(--text-primary)' : 'var(--text-secondary)' }}
        >
          <CalendarIcon />
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth} disabled={!canGoNext()}>
            <ChevronRight />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-semibold py-1" style={{ color: 'var(--text-secondary)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const ds = cellDateStr(day);
            const isSelected = ds === value;
            const isDisabled = ds > resolvedMax;
            const isToday = ds === todayStr;

            return (
              <button
                key={i}
                onClick={() => handleSelect(day)}
                disabled={isDisabled}
                className={`
                  h-8 w-full rounded-md text-xs transition-colors
                  ${isSelected
                    ? 'font-bold text-white'
                    : isToday
                      ? 'font-bold'
                      : 'font-normal'
                  }
                  ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-muted'}
                `}
                style={
                  isSelected
                    ? { background: 'var(--accent-color)', color: 'white' }
                    : isToday
                      ? { color: 'var(--accent-color)' }
                      : { color: 'var(--text-primary)' }
                }
              >
                {day}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
