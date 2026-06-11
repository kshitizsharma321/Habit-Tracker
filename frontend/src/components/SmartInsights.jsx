import { useMemo } from 'react';
import { getInsights } from '../utils/stats';

const INSIGHT_TYPES = [
  { match: /^🏆|^💪/, color: '#22c55e', label: 'Achievement' },
  { match: /^📈/, color: '#3b82f6', label: 'Improving' },
  { match: /^📉/, color: '#f87171', label: 'Declining' },
  { match: /^📊/, color: '#818cf8', label: 'Stats' },
  { match: /^🔮/, color: '#a855f7', label: 'Forecast' },
  { match: /^📅/, color: '#f59e0b', label: 'Pattern' },
  { match: /^✅|^🎉/, color: '#22c55e', label: 'Goal Met' },
  { match: /^🎯|^⏳/, color: '#f59e0b', label: 'Goal' },
  { match: /^➡️/, color: '#94a3b8', label: 'Steady' },
];

function getInsightMeta(text) {
  for (const t of INSIGHT_TYPES) {
    if (t.match.test(text)) return t;
  }
  return { color: '#818cf8', label: 'Insight' };
}

function extractEmoji(text) {
  const m = text.match(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+/u);
  return m ? { emoji: m[0], rest: text.slice(m[0].length).trim() } : { emoji: '', rest: text };
}

function InsightCard({ text }) {
  const meta = getInsightMeta(text);
  const { emoji, rest } = extractEmoji(text);
  const hex = meta.color;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '11px 14px',
        borderRadius: '10px',
        background: `color-mix(in srgb, ${hex} 8%, var(--card-bg))`,
        border: `1px solid color-mix(in srgb, ${hex} 20%, var(--border-color))`,
        borderLeft: `3px solid ${hex}`,
      }}
    >
      {emoji && (
        <span style={{ fontSize: '17px', lineHeight: '1.3', flexShrink: 0, marginTop: '1px' }}>
          {emoji}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: '9.5px',
            fontWeight: 700,
            color: hex,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: '3px',
          }}
        >
          {meta.label}
        </span>
        <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
          {rest}
        </p>
      </div>
    </div>
  );
}

export default function SmartInsights({ entries, definition }) {
  const insights = useMemo(() => {
    if (!entries || Object.keys(entries).length < 3) return [];
    return getInsights(entries, definition);
  }, [entries, definition]);

  if (insights.length === 0) return null;

  return (
    <div className="ht-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🧠</span>
        <h5 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          Smart Insights
        </h5>
        <span
          className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
          }}
        >
          {insights.length} insight{insights.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {insights.map((insight, i) => (
          <InsightCard key={i} text={insight} />
        ))}
      </div>
    </div>
  );
}
