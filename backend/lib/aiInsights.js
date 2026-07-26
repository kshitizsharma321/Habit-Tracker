// Gemini-backed "Coach's note" generation. The AI layer is an enhancement:
// callers must treat null (unconfigured / quota / error) as "show nothing"
// and fall back to the rule-based insights.

const { calculateCurrentStreak, isSuccess } = require('./streaks');

const SYSTEM_PROMPT = `You are a concise, encouraging habit coach inside a habit-tracking app.
Rules:
- Reply with 2-4 sentences of plain text. No markdown, no lists, no greetings.
- Reference the user's actual numbers (streak, averages, rates) — be specific, not generic.
- If goal.direction is "at_most" this is a REDUCTION habit (e.g. screen time): LOWER values are success. Never praise an increase for these.
- If goal.direction is "at_least", higher/consistent values are success.
- Be warm and motivating but honest — if the data slipped, say so kindly with one concrete suggestion.`;

const DIGEST_PROMPT = `You are a concise, encouraging habit coach writing ONE short daily summary of a user's whole habit dashboard.
Rules:
- Reply with 2-4 sentences of plain text. No markdown, no lists, no greetings.
- Mention 2-3 habits BY NAME with their actual numbers — celebrate the strongest, gently nudge the weakest.
- If a habit's goal.direction is "at_most" it is a REDUCTION habit: LOWER values are success. Never praise an increase for these.
- Be warm and specific, never generic filler.`;

function isAiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

// Compact stats summary — computed server-side from the habit's entries so the
// prompt stays small and no raw history leaves our control beyond aggregates.
function buildHabitSummary(definition, rows) {
  const entryMap = {};
  for (const r of rows) entryMap[r.date] = r.value;

  const dates = Object.keys(entryMap).sort();
  const values = dates.map((d) => entryMap[d]);
  const numeric = values.filter((v) => typeof v === 'number');
  const successDays = dates.filter((d) => isSuccess(definition, entryMap[d])).length;

  const summary = {
    habitName: definition.name,
    trackingType: definition.trackingType,
    unit: definition.unit || null,
    goal: definition.goal?.enabled
      ? { value: definition.goal.value, direction: definition.goal.direction }
      : null,
    currentStreak: calculateCurrentStreak(entryMap, definition),
    totalDaysLogged: dates.length,
    successRatePercent: dates.length ? Math.round((successDays / dates.length) * 100) : 0,
    // Last 14 raw entries let the model spot short-term patterns.
    recentEntries: dates.slice(-14).map((d) => ({ date: d, value: entryMap[d] })),
  };

  if (definition.trackingType === 'quantity' && numeric.length) {
    const total = numeric.reduce((a, b) => a + b, 0);
    summary.average = Math.round((total / numeric.length) * 100) / 100;
    summary.min = Math.min(...numeric);
    summary.max = Math.max(...numeric);
  }

  return summary;
}

// Account-wide summary for the dashboard digest — one compact block per habit.
function buildAccountSummary(definitions, rowsByHabit, todayKey) {
  const habits = definitions.map((def) => {
    const rows = rowsByHabit.get(String(def._id)) ?? [];
    const entryMap = {};
    for (const r of rows) entryMap[r.date] = r.value;
    const dates = Object.keys(entryMap);
    const successDays = dates.filter((d) => isSuccess(def, entryMap[d])).length;
    const habit = {
      name: def.name,
      trackingType: def.trackingType,
      unit: def.unit || null,
      goal: def.goal?.enabled ? { value: def.goal.value, direction: def.goal.direction } : null,
      currentStreak: calculateCurrentStreak(entryMap, def),
      totalDaysLogged: dates.length,
      successRatePercent: dates.length ? Math.round((successDays / dates.length) * 100) : 0,
      loggedToday: entryMap[todayKey] !== undefined,
      todayValue: entryMap[todayKey] ?? null,
    };
    const numeric = Object.values(entryMap).filter((v) => typeof v === 'number');
    if (def.trackingType === 'quantity' && numeric.length) {
      habit.average = Math.round((numeric.reduce((a, b) => a + b, 0) / numeric.length) * 100) / 100;
    }
    return habit;
  });

  return {
    date: todayKey,
    habitCount: habits.length,
    doneTodayCount: habits.filter((h) => h.loggedToday).length,
    habits,
  };
}

async function callGemini(systemPrompt, userText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          role: 'user',
          parts: [{ text: userText }],
        }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`AI insight generation failed (${res.status}): ${body.slice(0, 200)}`);
    return null;
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
  return text || null;
}

function generateCoachNote(summary) {
  return callGemini(SYSTEM_PROMPT, `Habit stats:\n${JSON.stringify(summary)}`);
}

function generateDailyDigest(summary) {
  return callGemini(DIGEST_PROMPT, `Dashboard stats:\n${JSON.stringify(summary)}`);
}

module.exports = { isAiConfigured, buildHabitSummary, buildAccountSummary, generateCoachNote, generateDailyDigest };
