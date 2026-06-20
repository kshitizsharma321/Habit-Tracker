/**
 * Simple least-squares linear regression.
 * No external dependencies.
 *
 * @param {number[]} yValues - Data points (implicit x = 0, 1, 2, ...)
 * @returns {{ slope: number, intercept: number, rSquared: number, predict: function, trend: string, percentageChange: number }}
 */
export function linearRegression(yValues) {
  const n = yValues.length;
  if (n < 3) {
    return {
      slope: 0,
      intercept: yValues[0] || 0,
      rSquared: 0,
      predict: (x) => yValues[0] || 0,
      trend: 'insufficient',
      percentageChange: 0,
    };
  }

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += yValues[i];
    sumXY += i * yValues[i];
    sumX2 += i * i;
    sumY2 += yValues[i] * yValues[i];
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssRes = yValues.reduce((acc, y, i) => acc + Math.pow(y - (slope * i + intercept), 2), 0);
  const ssTot = yValues.reduce((acc, y) => acc + Math.pow(y - meanY, 2), 0);
  const rSquared = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;

  const firstFit = slope * 0 + intercept;
  const lastFit = slope * (n - 1) + intercept;
  const percentageChange = firstFit !== 0 ? ((lastFit - firstFit) / Math.abs(firstFit)) * 100 : 0;

  let trend = 'steady';
  if (Math.abs(percentageChange) > 7 && rSquared > 0.3) {
    trend = percentageChange > 0 ? 'improving' : 'declining';
  }

  return {
    slope,
    intercept,
    rSquared,
    predict: (x) => slope * x + intercept,
    trend,
    percentageChange: Math.round(percentageChange),
  };
}
