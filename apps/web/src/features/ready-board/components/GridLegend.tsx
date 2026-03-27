'use client';

import { STATUS_CONFIG, type GridStatus } from '../types';

const LEGEND_ORDER: GridStatus[] = ['ready', 'in_progress', 'almost', 'blocked', 'held', 'done', 'waiting'];

type GridLegendProps = {
  counts?: Record<GridStatus, number>;
  activeStatuses?: Set<GridStatus>;
  onStatusToggle?: (status: GridStatus) => void;
};

export function GridLegend({ counts, activeStatuses, onStatusToggle }: GridLegendProps) {
  return (
    <div className="flex flex-wrap gap-4 px-1 py-2">
      {LEGEND_ORDER.map((status) => {
        const config = STATUS_CONFIG[status];
        const isActive = activeStatuses ? activeStatuses.has(status) : false;
        const isClickable = !!onStatusToggle;

        return (
          <button
            key={status}
            type="button"
            disabled={!isClickable}
            onClick={() => onStatusToggle?.(status)}
            className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors ${
              isClickable ? 'cursor-pointer hover:bg-zinc-800' : 'cursor-default'
            } ${isActive ? 'bg-zinc-800 ring-1 ring-amber-700' : ''}`}
          >
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: config.hex }}
            />
            <span className="text-xs text-zinc-400">
              {config.label}
              {counts && (
                <span className="ml-1 text-zinc-500">({counts[status]})</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
