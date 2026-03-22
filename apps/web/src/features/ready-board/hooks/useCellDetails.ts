'use client';

import { useEffect, useState } from 'react';
import { fetchCellDetails, type CellDetailData } from '../services/fetchCellDetails';

type UseCellDetailsResult = {
  data: CellDetailData | null;
  isLoading: boolean;
};

/**
 * Lazy-load hook: fetches GPS, photos, and report history when a cell is selected.
 * Cancels stale requests when cell changes.
 */
export function useCellDetails(
  areaId: string | null,
  tradeName: string | null,
): UseCellDetailsResult {
  const [data, setData] = useState<CellDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!areaId || !tradeName) {
      setData(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchCellDetails(areaId, tradeName).then((result) => {
      if (!cancelled) {
        setData(result);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [areaId, tradeName]);

  return { data, isLoading };
}
