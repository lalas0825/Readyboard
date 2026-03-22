'use client';

import { memo } from 'react';
import type { GridCellData } from '../types';
import { STATUS_CONFIG } from '../types';

type GridCellProps = {
  cell: GridCellData;
  onSelect: (cell: GridCellData) => void;
};

/** Wrench SVG — 10×10px inline icon (no external dep) */
function WrenchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute bottom-0.5 left-0.5 h-2.5 w-2.5 text-amber-400"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

/**
 * GridCell — single cell in the Ready Board grid.
 *
 * Renders a colored box with status label.
 * Icons: red dot (top-right) = active delay, wrench (bottom-left) = corrective action.
 * Wrapped in React.memo — only re-renders when its data changes.
 */
function GridCellComponent({ cell, onSelect }: GridCellProps) {
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_RENDERS) {
    console.log(`[GridCell] render: ${cell.trade_type} ${cell.effective_pct}%`);
  }

  const config = STATUS_CONFIG[cell.status];
  const showPct = cell.status !== 'waiting' && cell.effective_pct > 0;

  return (
    <td
      className="relative cursor-pointer border border-zinc-800 p-0 transition-colors hover:brightness-125"
      onClick={() => onSelect(cell)}
      title={`${cell.trade_type}: ${cell.effective_pct}%`}
    >
      <div
        className="flex h-10 min-w-[60px] flex-col items-center justify-center"
        style={{ backgroundColor: `${config.hex}20` }}
      >
        <span
          className="text-[10px] font-bold leading-none"
          style={{ color: config.hex }}
        >
          {config.label}
        </span>
        {showPct && (
          <span className="mt-0.5 text-[9px] leading-none text-zinc-400">
            {Math.round(cell.effective_pct)}%
          </span>
        )}
        {/* Red dot — top-right: active delay */}
        {cell.has_alert && (
          <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        )}
        {/* Wrench — bottom-left: corrective action assigned */}
        {cell.has_action && <WrenchIcon />}
      </div>
    </td>
  );
}

export const GridCell = memo(GridCellComponent, (prev, next) => {
  return (
    prev.cell.effective_pct === next.cell.effective_pct &&
    prev.cell.status === next.cell.status &&
    prev.cell.has_alert === next.cell.has_alert &&
    prev.cell.has_action === next.cell.has_action &&
    prev.cell.cost === next.cell.cost
  );
});
