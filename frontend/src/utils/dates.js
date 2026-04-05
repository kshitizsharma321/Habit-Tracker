export const TIMEZONE = 'Asia/Kolkata';

/**
 * Returns a YYYY-MM-DD key string for the given date, in IST.
 */
export function getDateKey(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Safely parse a stored "YYYY-MM-DD" key as local midnight.
 * Using `new Date(key)` alone parses as UTC midnight which can cause a
 * day-shift. Appending T00:00:00 treats it as local time instead.
 */
export function parseStoredDate(key) {
  return new Date(key + 'T00:00:00');
}

export const dateFormatters = {
  display: (date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: TIMEZONE,
    }),
  short: (date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: TIMEZONE,
    }),
  monthYear: (date) =>
    date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: TIMEZONE,
    }),
};
