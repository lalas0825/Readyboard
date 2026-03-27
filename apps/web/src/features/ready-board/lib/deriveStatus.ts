import type { RawCellData, DelayData, GridStatus } from '../types';

/**
 * Pure function: derives the visual status of a grid cell.
 *
 * Rules (from BUSINESS_LOGIC.md §Ready Board Status Logic):
 *   1. DONE   — this trade complete (100% + gates passed)
 *   2. HELD   — active delay on this area+trade
 *   3. READY  — all prior trades complete (first trade is always ready)
 *   4. ALMOST — immediate prior trade >= 80%
 *   5. BLOCKED — immediate prior trade > 0% but < 80%
 *   6. WAITING — all prior trades at 0% (too far in sequence to be relevant)
 */
export function deriveStatus(
  cell: RawCellData,
  priorCells: RawCellData[],
  delay: DelayData | undefined,
): GridStatus {
  // 1. DONE
  if (cell.effective_pct >= 100 && cell.all_gates_passed) {
    return 'done';
  }

  // 2. HELD (active delay — ended_at IS NULL is filtered at query time)
  if (delay) {
    return 'held';
  }

  // 2.5. IN PROGRESS — work started (1-99%) on this trade
  if (cell.effective_pct > 0 && cell.effective_pct < 100) {
    return 'in_progress';
  }

  // 3. First trade in sequence — always ready
  if (priorCells.length === 0) {
    return 'ready';
  }

  // 4. All prior trades complete → ready
  const allPriorDone = priorCells.every(
    (p) => p.effective_pct >= 100 && p.all_gates_passed,
  );
  if (allPriorDone) {
    return 'ready';
  }

  // 5. Immediate prior >= 80% → almost
  const immediatePrior = priorCells[priorCells.length - 1];
  if (immediatePrior.effective_pct >= 80) {
    return 'almost';
  }

  // 6. Immediate prior > 0% but < 80% → blocked
  if (immediatePrior.effective_pct > 0) {
    return 'blocked';
  }

  // 7. Prior trade at 0% — nothing happening yet
  return 'waiting';
}
