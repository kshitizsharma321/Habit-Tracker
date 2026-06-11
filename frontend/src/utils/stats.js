// Backward-compatible redirect to the new modular stats system.
// All existing imports continue to work unchanged.

export {
  getSortedKeys,
  fillMissingDays,
  downloadCSV,
  groupByMonth,
  getBinaryStats,
  calculateStreaks,
  getWeekData,
  getMonthData,
  getAdvancedStats,
  getNumericStats,
  getNumericTrend,
  getMovingAverage,
  getInsights,
  linearRegression,
  forecast,
  getStats,
  getTypeStats,
  calculateStreaksFromGoal,
} from './stats/index';
