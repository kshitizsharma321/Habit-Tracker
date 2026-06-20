// Color palette — 15 tokens for the color picker (templates use a subset).
// Distribution tries to avoid same-color neighbors within a category.
//
// green   #22c55e — nature, health habits
// blue    #3b82f6 — learning, tech
// purple  #a855f7 — mind, reading
// amber   #f59e0b — calm, mindful, sun
// cyan    #06b6d4 — hydration, hygiene
// pink    #ec4899 — journaling, positivity
// indigo  #6366f1 — sleep, rest, night
// teal    #14b8a6 — movement, finance
// red     #ef4444 — strength, restriction
// orange  #f97316 — energy, discipline
// lime    #84cc16 — fresh, growth
// sky     #0ea5e9 — clarity, focus
// fuchsia #d946ef — creativity, fun
// rose    #f43f5e — passion, love
// slate   #64748b — neutral, minimal

export const TEMPLATES = [
  // ── Core habits ──────────────────────────────────────────────────────────────
  { name: 'Exercise',    icon: '🏋️', type: 'completion', color: '#22c55e', unit: 'minutes',   goal: { value: 30 } },
  { name: 'Study',       icon: '📚', type: 'quantity',   color: '#3b82f6', unit: 'hours',   goal: { value: 2 } },
  { name: 'Read',        icon: '📖', type: 'completion', color: '#a855f7' },
  { name: 'Meditate',    icon: '🧘', type: 'completion', color: '#f59e0b' },
  { name: 'Water',       icon: '💧', type: 'quantity',   color: '#06b6d4', unit: 'glasses', goal: { value: 8 } },
  { name: 'Sleep',       icon: '😴', type: 'quantity',   color: '#6366f1', unit: 'hours',   goal: { value: 8 } },
  { name: 'Steps',       icon: '👟', type: 'quantity',   color: '#14b8a6', unit: 'steps',   goal: { value: 8000 } },
  { name: 'Coding',      icon: '💻', type: 'quantity',   color: '#3b82f6', unit: 'hours',   goal: { value: 2 } },

  // ── Fitness ──────────────────────────────────────────────────────────────────
  { name: 'Running',      icon: '🏃', type: 'quantity',   color: '#f97316', unit: 'km',   goal: { value: 5 } },
  { name: 'Pushups',      icon: '💪', type: 'quantity',   color: '#ef4444', unit: 'reps', goal: { value: 20 } },
  { name: 'Yoga',         icon: '🤸', type: 'completion', color: '#a855f7' },
  { name: 'Outdoor Walk', icon: '🌳', type: 'completion', color: '#22c55e' },

  // ── Mind & wellbeing ─────────────────────────────────────────────────────────
  { name: 'Mindfulness',         icon: '🧠', type: 'quantity',   color: '#f59e0b', unit: 'minutes', goal: { value: 10 } },
  { name: 'Screen-free Evening', icon: '📺', type: 'completion', color: '#6366f1' },

  // ── Learning ─────────────────────────────────────────────────────────────────
  { name: 'Language Practice', icon: '🌍', type: 'completion', color: '#3b82f6' },

];

export const COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#ef4444', // red
  '#f97316', // orange
  '#84cc16', // lime
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
  '#f43f5e', // rose
  '#64748b', // slate
];

export const TYPE_LABELS = {
  completion: 'Done / Not Done',
  quantity: 'How much?',
};
