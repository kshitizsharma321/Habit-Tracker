import { useState, useEffect, useCallback } from 'react';
import { getDateKey, dateFormatters } from '../../utils/dates';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { DatePicker } from '../ui/date-picker';

export default function DynamicLogEntry({ definition, existingEntry, onLog, isSaving, habitEntries, onAnimationTrigger }) {
  const [useManualDate, setUseManualDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [numericValue, setNumericValue] = useState('');

  const todayStr = getDateKey(new Date());
  const dateKey = getDateKey(selectedDate);

  const dateEntry = habitEntries?.[dateKey];
  const entryForDate = useManualDate ? dateEntry : existingEntry;
  const alreadyLogged = entryForDate?.value !== undefined && entryForDate?.value !== null;

  const { trackingType, unit } = definition || {};

  useEffect(() => {
    if (!useManualDate) setSelectedDate(new Date());
  }, [useManualDate]);

  useEffect(() => {
    if (alreadyLogged) {
      const val = entryForDate.value;
      if (trackingType === 'quantity') {
        setNumericValue(String(val));
      }
    } else {
      setNumericValue('');
    }
  }, [entryForDate, trackingType, alreadyLogged]);

  const handleLog = useCallback((value) => {
    if (isSaving) return;
    onLog({ date: dateKey, value });
    if (trackingType === 'completion' && onAnimationTrigger) {
      onAnimationTrigger(value === 'yes' ? 'success' : 'failure');
    }
  }, [isSaving, dateKey, onLog, trackingType, onAnimationTrigger]);

  // Quantity entries must be a non-negative number, capped to 2 decimals. Empty/invalid is ignored.
  const logIfValid = useCallback((raw) => {
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) return;
    handleLog(Math.round(val * 100) / 100);
  }, [handleLog]);

  const renderInput = () => {
    switch (trackingType) {
      case 'completion':
        return (
          <div className="flex gap-2 mt-2">
            <Button variant={entryForDate?.value === 'yes' ? 'default' : 'outline'}
              onClick={() => handleLog('yes')} disabled={isSaving}
              className={`flex-1 ${entryForDate?.value === 'yes' ? 'bg-[var(--success-color)] text-white hover:bg-[var(--success-color)]/90' : ''}`}>
              ✅ Done
            </Button>
            <Button variant={entryForDate?.value === 'no' ? 'default' : 'outline'}
              onClick={() => handleLog('no')} disabled={isSaving}
              className={`flex-1 ${entryForDate?.value === 'no' ? 'bg-[var(--danger-color)] text-white hover:bg-[var(--danger-color)]/90' : ''}`}>
              ❌ Skip
            </Button>
          </div>
        );

      case 'quantity': {
        const loggedAmount = typeof entryForDate?.value === 'number' ? entryForDate.value : null;
        const addAmount = (n) => {
          const next = Math.round(((loggedAmount || 0) + n) * 100) / 100;
          setNumericValue(String(next));
          handleLog(next);
        };
        return (
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-2">
              <Input
                type="number" min="0" step="0.01" value={numericValue}
                onChange={(e) => setNumericValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') logIfValid(numericValue);
                }}
                placeholder={unit ? `How many ${unit}?` : 'How much today?'}
                className="w-36 text-center"
              />
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
              <Button onClick={() => logIfValid(numericValue)} disabled={isSaving || numericValue === ''}>
                📝 Log
              </Button>
            </div>
            {/* Increment chips — ADD to the day's total instead of overwriting it */}
            <div className="flex gap-1.5 flex-wrap items-center">
              {[1, 5].map((n) => (
                <Button key={n} variant="outline" size="sm" disabled={isSaving}
                  onClick={() => addAmount(n)}>
                  +{n}{unit ? ` ${unit}` : ''}
                </Button>
              ))}
              {loggedAmount !== null && (
                <span className="text-xs text-muted-foreground">
                  Logged: {loggedAmount}{unit ? ` ${unit}` : ''}
                </span>
              )}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const getHint = () => {
    switch (trackingType) {
      case 'completion': return 'Select Done or Skip';
      case 'quantity': return 'Type a value and press Enter or Log';
      default: return '';
    }
  };

  const getQuestion = () => {
    const dateStr = dateFormatters.display(selectedDate);
    return `${definition?.name} — ${dateStr}`;
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
          <Switch
            id="manual-date"
            checked={useManualDate}
            onCheckedChange={setUseManualDate}
          />
          <label htmlFor="manual-date" className="cursor-pointer">Log for a different date</label>
        </div>
        {useManualDate && (
          <DatePicker
            value={getDateKey(selectedDate)}
            onChange={(ds) => setSelectedDate(new Date(ds + 'T00:00:00'))}
            maxDate={todayStr}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{getQuestion()}</span>
      </div>

      {renderInput()}

      <p className="text-xs text-muted-foreground mt-2">{getHint()}</p>
    </div>
  );
}
