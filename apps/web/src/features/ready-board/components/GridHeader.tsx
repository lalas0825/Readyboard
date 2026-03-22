'use client';

/** Trade abbreviations for column headers */
const TRADE_ABBREV: Record<string, string> = {
  'Rough Plumbing': 'PLMB',
  'Metal Stud Framing': 'FRAM',
  'MEP Rough-In': 'MEP-R',
  'Fire Stopping': 'FIRE',
  'Insulation & Drywall': 'DRYW',
  'Waterproofing': 'WTPF',
  'Tile / Stone': 'TILE',
  'Paint': 'PAINT',
  'Ceiling Grid / ACT': 'CEIL',
  'MEP Trim-Out': 'MEP-T',
  'Doors & Hardware': 'DOOR',
  'Millwork & Countertops': 'MILL',
  'Flooring': 'FLOOR',
  'Final Clean & Punch': 'PUNCH',
};

type GridHeaderProps = {
  trades: string[];
};

export function GridHeader({ trades }: GridHeaderProps) {
  return (
    <thead>
      <tr>
        <th className="sticky left-0 top-0 z-20 border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-xs font-medium text-zinc-400">
          Area
        </th>
        {trades.map((trade) => (
          <th
            key={trade}
            className="sticky top-0 z-10 border border-zinc-800 bg-zinc-900 px-1 py-2 text-center text-[10px] font-medium text-zinc-400"
            title={trade}
          >
            {TRADE_ABBREV[trade] ?? trade.slice(0, 4).toUpperCase()}
          </th>
        ))}
      </tr>
    </thead>
  );
}
