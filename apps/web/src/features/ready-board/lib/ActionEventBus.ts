import type { CorrectiveActionData } from '../types';

// ─── Event Types ─────────────────────────────────────

export type ActionEvent =
  | {
      type: 'action:confirmed';
      key: string; // area_id:trade_name
      action: CorrectiveActionData;
      optimisticInsertedAt: number; // Date.now() from optimistic creation
    }
  | {
      type: 'action:reverted';
      key: string;
      action: CorrectiveActionData; // the optimistic data that was removed
      optimisticInsertedAt: number;
    };

export type ActionEventHandler = (event: ActionEvent) => void;

// ─── Bus Implementation ──────────────────────────────

/** @internal — class exported for testing only */
export class ActionEventBusImpl {
  private handlers: Set<ActionEventHandler> = new Set();

  subscribe(handler: ActionEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(event: ActionEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[ActionEventBus] Handler error:', err);
        }
      }
    }
  }
}

/** Module-level singleton — lives outside React, never causes re-renders */
export const actionBus = new ActionEventBusImpl();
