'use client';

import { STATUS_CONFIG, type GridStatus } from '../types';

const ALL_STATUSES: GridStatus[] = ['ready', 'in_progress', 'almost', 'blocked', 'held', 'done', 'waiting'];

type GridFilterBarProps = {
  floors: string[];
  trades: string[];
  selectedFloors: Set<string>;
  selectedTrades: Set<string>;
  selectedStatuses: Set<GridStatus>;
  onFloorToggle: (floor: string) => void;
  onTradeToggle: (trade: string) => void;
  onStatusToggle: (status: GridStatus) => void;
  onClearAll: () => void;
};

const TRADE_SHORT: Record<string, string> = {
  'Rough Plumbing': 'Plumb',
  'Metal Stud Framing': 'Frame',
  'MEP Rough-In': 'MEP-R',
  'Fire Stopping': 'Fire',
  'Insulation & Drywall': 'Drywall',
  'Waterproofing': 'Waterpr',
  'Tile / Stone': 'Tile',
  'Paint': 'Paint',
  'Ceiling Grid / ACT': 'Ceiling',
  'MEP Trim-Out': 'MEP-T',
  'Doors & Hardware': 'Doors',
  'Millwork & Countertops': 'Mill',
  'Flooring': 'Floor',
  'Final Clean & Punch': 'Punch',
};

export function GridFilterBar({
  floors,
  trades,
  selectedFloors,
  selectedTrades,
  selectedStatuses,
  onFloorToggle,
  onTradeToggle,
  onStatusToggle,
  onClearAll,
}: GridFilterBarProps) {
  const hasActiveFilters =
    selectedFloors.size > 0 || selectedTrades.size > 0 || selectedStatuses.size > 0;

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 print:hidden">
      {/* Floor chips */}
      <FilterRow label="Floor">
        {floors.map((floor) => (
          <Chip
            key={floor}
            label={`F${floor}`}
            active={selectedFloors.has(floor)}
            onClick={() => onFloorToggle(floor)}
          />
        ))}
      </FilterRow>

      {/* Trade chips */}
      <FilterRow label="Trade">
        {trades.map((trade) => (
          <Chip
            key={trade}
            label={TRADE_SHORT[trade] ?? trade.slice(0, 5)}
            title={trade}
            active={selectedTrades.has(trade)}
            onClick={() => onTradeToggle(trade)}
          />
        ))}
      </FilterRow>

      {/* Status chips */}
      <FilterRow label="Status">
        {ALL_STATUSES.map((status) => (
          <Chip
            key={status}
            label={STATUS_CONFIG[status].label}
            active={selectedStatuses.has(status)}
            onClick={() => onStatusToggle(status)}
            dotColor={STATUS_CONFIG[status].hex}
          />
        ))}
      </FilterRow>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={onClearAll}
          className="text-xs text-zinc-500 underline hover:text-zinc-300"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  title,
  dotColor,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  title?: string;
  dotColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
        active
          ? 'border-amber-700 bg-amber-950/50 text-amber-300'
          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
      }`}
    >
      {dotColor && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
      )}
      {label}
    </button>
  );
}
