'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchCellDetails, type CellDetailData } from '../services/fetchCellDetails';

type UseCellDetailsResult = {
  data: CellDetailData | null;
  isLoading: boolean;
  refetch: () => void;
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
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => setFetchTick((t) => t + 1), []);

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
  }, [areaId, tradeName, fetchTick]);

  return { data, isLoading, refetch };
}
