import { describe, it, expect } from 'vitest';
import {
  calculateBurnRate,
  calculateProjectedFinish,
  getScheduleDelta,
} from '../services/forecastEngine';
import type { FieldReportForBurnRate } from '../types';

// ─── calculateBurnRate (EMA with α=0.5, span=3) ────────────

describe('calculateBurnRate (EMA)', () => {
  it('applies EMA weighting — recent rates have more impact', () => {
    const reports: FieldReportForBurnRate[] = [
      { progressPct: 0, createdAt: '2026-03-01' },
      { progressPct: 10, createdAt: '2026-03-03' }, // rate: 5%/day
      { progressPct: 25, createdAt: '2026-03-06' }, // rate: 5%/day
      { progressPct: 40, createdAt: '2026-03-10' }, // rate: 3.75%/day (slowdown)
    ];

    const rate = calculateBurnRate(reports);
    // EMA: seed=5, step1: 0.5*5 + 0.5*5 = 5, step2: 0.5*3.75 + 0.5*5 = 4.375
    // EMA gives 4.375 (vs SMA of 4.583) — recent slowdown pulls rate down more
    expect(rate).toBeCloseTo(4.375, 2);
  });

  it('weights acceleration — recent speedup pulls rate UP', () => {
    const reports: FieldReportForBurnRate[] = [
      { progressPct: 0, createdAt: '2026-03-01' },
      { progressPct: 5, createdAt: '2026-03-03' },  // rate: 2.5%/day (slow start)
      { progressPct: 15, createdAt: '2026-03-05' }, // rate: 5%/day
      { progressPct: 35, createdAt: '2026-03-07' }, // rate: 10%/day (fast finish)
    ];

    const rate = calculateBurnRate(reports);
    // EMA: seed=2.5, step1: 0.5*5 + 0.5*2.5 = 3.75, step2: 0.5*10 + 0.5*3.75 = 6.875
    // SMA would be 5.83 — EMA correctly reflects acceleration
    expect(rate).toBeCloseTo(6.875, 2);
  });

  it('returns 0 when fewer than 2 reports (insufficient data)', () => {
    expect(calculateBurnRate([])).toBe(0);
    expect(calculateBurnRate([{ progressPct: 50, createdAt: '2026-03-01' }])).toBe(0);
  });

  it('handles non-consecutive days correctly', () => {
    const reports: FieldReportForBurnRate[] = [
      { progressPct: 20, createdAt: '2026-03-01' },
      { progressPct: 30, createdAt: '2026-03-11' }, // +10% over 10 days = 1%/day
    ];

    const rate = calculateBurnRate(reports);
    // Single rate → EMA seed = 1.0
    expect(rate).toBeCloseTo(1.0, 2);
  });

  it('filters non-work days (zero time span pairs skipped)', () => {
    const reports: FieldReportForBurnRate[] = [
      { progressPct: 20, createdAt: '2026-03-01' },
      { progressPct: 25, createdAt: '2026-03-01' }, // same day — skipped
      { progressPct: 30, createdAt: '2026-03-03' }, // +5% over 2 days = 2.5%/day
    ];

    const rate = calculateBurnRate(reports);
    // Only one valid rate: 2.5 → EMA seed = 2.5
    expect(rate).toBeCloseTo(2.5, 2);
  });

  it('sorts reports by date regardless of input order', () => {
    const reports: FieldReportForBurnRate[] = [
      { progressPct: 30, createdAt: '2026-03-05' },
      { progressPct: 10, createdAt: '2026-03-01' },
      { progressPct: 20, createdAt: '2026-03-03' },
    ];

    const rate = calculateBurnRate(reports);
    // Sorted: 10→20 (2d, 5/d), 20→30 (2d, 5/d) — EMA: seed=5, 0.5*5+0.5*5=5
    expect(rate).toBeCloseTo(5.0, 2);
  });

  it('returns 0 when all progress deltas are negative (regression)', () => {
    const reports: FieldReportForBurnRate[] = [
      { progressPct: 50, createdAt: '2026-03-01' },
      { progressPct: 40, createdAt: '2026-03-03' }, // negative delta — skipped
    ];

    expect(calculateBurnRate(reports)).toBe(0);
  });
});

// ─── calculateProjectedFinish ───────────────────────────

describe('calculateProjectedFinish', () => {
  const today = new Date('2026-03-22');

  it('projects correct date from remaining pct and burn rate', () => {
    const result = calculateProjectedFinish(20, 5, today);
    // 20% / 5%/day = 4 days → March 26
    expect(result).not.toBeNull();
    expect(result!.toISOString().split('T')[0]).toBe('2026-03-26');
  });

  it('returns null when burn rate is 0 (stalled)', () => {
    expect(calculateProjectedFinish(50, 0, today)).toBeNull();
  });

  it('returns null when burn rate is negative', () => {
    expect(calculateProjectedFinish(50, -2, today)).toBeNull();
  });

  it('returns today when remaining pct is 0 (complete)', () => {
    const result = calculateProjectedFinish(0, 5, today);
    expect(result).not.toBeNull();
    expect(result!.toISOString().split('T')[0]).toBe('2026-03-22');
  });

  it('handles large remaining work with slow burn rate', () => {
    const result = calculateProjectedFinish(80, 1, today);
    const deltaDays = Math.round((result!.getTime() - today.getTime()) / 86_400_000);
    expect(deltaDays).toBe(80);
  });
});

// ─── getScheduleDelta ───────────────────────────────────

describe('getScheduleDelta', () => {
  it('returns positive days when behind schedule', () => {
    const baseline = new Date('2026-04-01');
    const projected = new Date('2026-04-06');
    expect(getScheduleDelta(baseline, projected)).toBe(5);
  });

  it('returns negative days when ahead of schedule', () => {
    const baseline = new Date('2026-04-10');
    const projected = new Date('2026-04-07');
    expect(getScheduleDelta(baseline, projected)).toBe(-3);
  });

  it('returns 0 when on schedule', () => {
    const date = new Date('2026-04-15');
    expect(getScheduleDelta(date, date)).toBe(0);
  });
});
