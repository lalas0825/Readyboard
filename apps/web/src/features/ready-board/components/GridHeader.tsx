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

/** Splits a composite trade_type key "{trade_name}::{phase_label}" into parts. */
function splitTradeKey(key: string): { name: string; phase: string | null } {
  const idx = key.indexOf('::');
  if (idx === -1) return { name: key, phase: null };
  return { name: key.slice(0, idx), phase: key.slice(idx + 2) };
}

function abbreviate(name: string): string {
  return TRADE_ABBREV[name] ?? name.slice(0, 4).toUpperCase();
}

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
        {trades.map((key) => {
          const { name, phase } = splitTradeKey(key);
          const abbr = abbreviate(name);
          const phaseNum = phase?.match(/\d+/)?.[0];
          const label = phaseNum ? `${abbr} P${phaseNum}` : abbr;
          const tooltip = phase ? `${name} — ${phase}` : name;
          return (
            <th
              key={key}
              className="sticky top-0 z-10 border border-zinc-800 bg-zinc-900 px-1 py-2 text-center text-[10px] font-medium text-zinc-400"
              title={tooltip}
            >
              <div>{label}</div>
              {phase && (
                <div className="text-[8px] font-normal text-zinc-500">
                  {phase.length > 10 ? `${phase.slice(0, 9)}…` : phase}
                </div>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
