import { useMemo, useState } from 'react';
import { getDateKey, parseStoredDate, dateFormatters } from '../utils/dates';
import { isGoalMet } from '../utils/stats';

const DAYS = 30;
const W = 600;
const H = 170;
const PAD = { top: 14, right: 12, bottom: 22, left: 40 };

// 30-day line chart for quantity habits. Single series in the habit's own color;
// missing days break the line (a gap is a gap, not a zero); dashed goal line.
export default function TrendChart({ entries, definition }) {
  const [hovered, setHovered] = useState(null);

  const { points, segments, yMax, goalY, tickValues, firstLabel, lastLabel } = useMemo(() => {
    const today = parseStoredDate(getDateKey(new Date()));
    const days = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(getDateKey(d));
    }

    const goal = definition?.goal?.value || 0;
    const values = days.map((k) => (typeof entries[k] === 'number' ? entries[k] : null));
    const present = values.filter((v) => v !== null);
    const rawMax = Math.max(goal, ...(present.length ? present : [1]));
    const yMax = rawMax * 1.1 || 1;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (days.length === 1 ? plotW / 2 : (i / (days.length - 1)) * plotW);
    const y = (v) => PAD.top + plotH - (v / yMax) * plotH;

    const points = days.map((key, i) => (values[i] === null ? null : {
      key,
      value: values[i],
      x: x(i),
      y: y(values[i]),
      met: goal ? isGoalMet(values[i], goal, definition?.goal?.direction) : values[i] > 0,
    })).filter(Boolean);

    // Consecutive-day runs become polyline segments; any missing day breaks the line.
    const segments = [];
    let run = [];
    let prevKey = null;
    for (const p of points) {
      const contiguous = prevKey !== null && (() => {
        const prev = parseStoredDate(prevKey);
        prev.setDate(prev.getDate() + 1);
        return getDateKey(prev) === p.key;
      })();
      if (!contiguous && run.length) { segments.push(run); run = []; }
      run.push(p);
      prevKey = p.key;
    }
    if (run.length) segments.push(run);

    const mid = yMax / 2;
    return {
      points,
      segments,
      yMax,
      goalY: goal ? y(goal) : null,
      tickValues: [
        { v: yMax, y: y(yMax) },
        { v: mid, y: y(mid) },
      ],
      firstLabel: dateFormatters.short(parseStoredDate(days[0])),
      lastLabel: dateFormatters.short(parseStoredDate(days[days.length - 1])),
    };
  }, [entries, definition]);

  if (points.length < 2) return null;

  const color = definition?.color || 'var(--accent-color)';
  const unit = definition?.unit ? ` ${definition.unit}` : '';
  const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(1));
  const baselineY = H - PAD.bottom;

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
        Last 30 Days
      </h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${definition?.name} — last 30 days trend`}>
        {/* Recessive grid */}
        {tickValues.map(({ v, y }) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--border-color)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{fmt(v)}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={baselineY} y2={baselineY} stroke="var(--border-color)" strokeWidth="1" />

        {/* Goal reference — neutral dashed, labeled in text ink */}
        {goalY !== null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={goalY} y2={goalY}
              stroke="var(--text-secondary)" strokeWidth="1" strokeDasharray="5 4" opacity="0.7" />
            <text x={W - PAD.right} y={goalY - 4} textAnchor="end" fontSize="10" fill="var(--text-secondary)">
              {definition.goal.direction === 'at_most' ? 'Limit' : 'Goal'} {fmt(definition.goal.value)}
            </text>
          </g>
        )}

        {/* Line segments (gaps break the line) */}
        {segments.map((seg, i) => (
          <polyline
            key={i}
            points={seg.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Markers with an oversized hit target */}
        {points.map((p) => (
          <g key={p.key}>
            <circle
              cx={p.x} cy={p.y} r={hovered?.key === p.key ? 6 : 4}
              fill={p.met ? color : 'var(--card-bg)'}
              stroke={color} strokeWidth="2"
            />
            <circle
              cx={p.x} cy={p.y} r="10" fill="transparent" style={{ cursor: 'default' }}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setHovered(p)}
            />
          </g>
        ))}

        {/* X labels — first + last day only */}
        <text x={PAD.left} y={H - 6} fontSize="10" fill="var(--text-secondary)">{firstLabel}</text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{lastLabel}</text>
      </svg>

      {/* Hover readout (same pattern as the streak calendar's info bar) */}
      <p className="text-xs mt-1 min-h-[1.25rem]" style={{ color: 'var(--text-secondary)' }}>
        {hovered
          ? `${dateFormatters.short(parseStoredDate(hovered.key))} — ${fmt(hovered.value)}${unit}${definition?.goal?.value ? (hovered.met ? ' · goal met ✅' : ' · goal missed') : ''}`
          : 'Hover a point for details · hollow = goal missed'}
      </p>
    </div>
  );
}
