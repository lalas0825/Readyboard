'use client';

import { useEffect, useRef } from 'react';
import { actionBus } from '../lib/ActionEventBus';
import type { CorrectiveActionData } from '../types';

/**
 * Passive observer hook — watches actionMap transitions and emits to ActionEventBus.
 *
 * Tracks three things:
 * 1. New optimistic entry appears → records Date.now() for timing metrics
 * 2. isOptimistic: true → false/undefined → emits 'action:confirmed'
 * 3. Optimistic entry disappears → emits 'action:reverted'
 *
 * This hook does NOT trigger re-renders. It reads actionMap via ref comparison.
 * All side-effects happen in subscribers registered on the bus, not here.
 */
export function useActionObserver(
  actionMap: Map<string, CorrectiveActionData>,
) {
  const prevMapRef = useRef<Map<string, CorrectiveActionData>>(new Map());
  const timestampMapRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const prev = prevMapRef.current;
    const timestamps = timestampMapRef.current;

    // Skip first render (INIT populates the map)
    if (prev.size === 0 && actionMap.size > 0) {
      prevMapRef.current = new Map(actionMap);
      return;
    }

    // Detect NEW optimistic entries → record insertion timestamp
    for (const [key, currAction] of actionMap) {
      if (currAction.isOptimistic && !prev.has(key)) {
        timestamps.set(key, Date.now());
      }
    }

    // Detect transitions
    for (const [key, prevAction] of prev) {
      const currAction = actionMap.get(key);
      const insertedAt = timestamps.get(key) ?? Date.now();

      // Transition 1: optimistic → confirmed (server replaced tempId with real data)
      if (prevAction.isOptimistic && currAction && !currAction.isOptimistic) {
        actionBus.emit({
          type: 'action:confirmed',
          key,
          action: currAction,
          optimisticInsertedAt: insertedAt,
        });
        timestamps.delete(key);
      }

      // Transition 2: optimistic entry disappeared (server failed, reverted)
      if (prevAction.isOptimistic && !currAction) {
        actionBus.emit({
          type: 'action:reverted',
          key,
          action: prevAction,
          optimisticInsertedAt: insertedAt,
        });
        timestamps.delete(key);
      }
    }

    prevMapRef.current = new Map(actionMap);
  }, [actionMap]);
}
