'use client';

import { memo } from 'react';
import { GridCell } from './GridCell';
import type { GridRow as GridRowType, GridCellData } from '../types';

type GridRowProps = {
  row: GridRowType;
  onSelectCell: (cell: GridCellData) => void;
};

function GridRowComponent({ row, onSelectCell }: GridRowProps) {
  return (
    <tr>
      <td className="sticky left-0 z-10 whitespace-nowrap border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
        {row.area_name}
      </td>
      {row.cells.map((cell) => (
        <GridCell key={cell.trade_type} cell={cell} onSelect={onSelectCell} />
      ))}
    </tr>
  );
}

export const GridRow = memo(GridRowComponent);
