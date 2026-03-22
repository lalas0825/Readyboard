'use client';

import { useEffect, useRef, useState } from 'react';
import { actionBus, type ActionEvent } from '@/features/ready-board';

export type AlertMetrics = {
  confirmedOps: number;
  revertedOps: number;
  ratio: number; // confirmed / total (0-1), represents "system health"
};

/**
 * Bus subscriber hook — tracks confirmed/reverted ratio for forecast section.
 * Uses useRef for accumulation (no re-renders from events), refreshes display every 5s.
 */
export function useAlertMetrics(): AlertMetrics {
  const ref = useRef({ confirmed: 0, reverted: 0 });
  const [metrics, setMetrics] = useState<AlertMetrics>({
    confirmedOps: 0,
    revertedOps: 0,
    ratio: 1,
  });

  useEffect(() => {
    const unsub = actionBus.subscribe((event: ActionEvent) => {
      if (event.type === 'action:confirmed') ref.current.confirmed++;
      if (event.type === 'action:reverted') ref.current.reverted++;
    });

    const interval = setInterval(() => {
      const { confirmed, reverted } = ref.current;
      const total = confirmed + reverted;
      setMetrics({
        confirmedOps: confirmed,
        revertedOps: reverted,
        ratio: total > 0 ? confirmed / total : 1,
      });
    }, 5_000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return metrics;
}
