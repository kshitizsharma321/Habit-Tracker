// Unified stats dispatcher — routes to type-specific stats based on trackingType
// Also re-exports for backward compatibility

import { getSortedKeys, fillMissingDays, downloadCSV, groupByMonth, ewma, wilsonScore, pearsonCorrelation } from './shared';
import { getBinaryStats, calculateStreaks, calculateStreaksFromGoal, getWeekData as binaryGetWeek, getMonthData as binaryGetMonth, getAdvancedStats } from './binary';
import { getNumericStats, getNumericTrend, getMovingAverage, getWeekNumericData, getZScoreAnomalies, getCoefficientOfVariation } from './numeric';
import { getInsights } from './insights';
import { linearRegression, forecast } from './regression';

export function getStats(entries, trackingType) {
  switch (trackingType) {
    case 'completion':
      return getBinaryStats(entries);
    case 'quantity':
      return getNumericStats(entries);
    default:
      return getBinaryStats(entries);
  }
}

export function getTypeStats(entries, trackingType) {
  switch (trackingType) {
    case 'completion':
      return { ...getBinaryStats(entries), type: 'completion' };
    case 'quantity':
      return { ...getNumericStats(entries), trend: getNumericTrend(entries), type: 'quantity' };
    default:
      return { ...getBinaryStats(entries), type: 'completion' };
  }
}

// Re-exports for backward compatibility
export {
  getSortedKeys,
  fillMissingDays,
  downloadCSV,
  groupByMonth,
  ewma,
  wilsonScore,
  pearsonCorrelation,
  getBinaryStats,
  calculateStreaks,
  calculateStreaksFromGoal,
  binaryGetWeek as getWeekData,
  binaryGetMonth as getMonthData,
  getAdvancedStats,
  getNumericStats,
  getNumericTrend,
  getMovingAverage,
  getWeekNumericData,
  getZScoreAnomalies,
  getCoefficientOfVariation,
  getInsights,
  linearRegression,
  forecast,
};
