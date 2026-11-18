export function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const normal = raw / power;
  const step = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 2.5 ? 2.5 : normal <= 5 ? 5 : 10;
  return step * power;
}

export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const normal = value / power;
  const step = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 2.5 ? 2.5 : normal <= 5 ? 5 : 10;
  return step * power;
}

export interface ProfitBarScale {
  min: number;
  max: number;
  step: number;
}

/**
 * Y-axis range for the daily profit bars. Negative values always sit above
 * the bottom axis line: if the lowest bar lands on a tick, the range drops
 * one tick further below it.
 */
export function profitBarScale(values: readonly number[]): ProfitBarScale {
  const rawMax = Math.max(...values, 0);
  const rawMin = Math.min(...values, 0);
  const step = niceStep(Math.max(rawMax, -rawMin) / 4);
  const max = Math.ceil(rawMax / step) * step;
  let min = 0;

  if (rawMin < 0) {
    const roundedMin = Math.floor(rawMin / step) * step;
    min = roundedMin < rawMin ? roundedMin : roundedMin - step;
  }

  return { min, max, step };
}

/** Label position for a profit bar. Negative labels hang below the bar. */
export function profitBarLabelLayout(value: number, valueY: number) {
  return { y: value < 0 ? valueY + 12 : valueY - 6 };
}
