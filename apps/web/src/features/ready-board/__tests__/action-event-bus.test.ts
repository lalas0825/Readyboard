import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionEventBusImpl, type ActionEvent } from '../lib/ActionEventBus';
import type { CorrectiveActionData } from '../types';

// ─── Factory ─────────────────────────────────────────

function makeAction(overrides: Partial<CorrectiveActionData> = {}): CorrectiveActionData {
  return {
    id: 'act-1',
    delay_log_id: 'dl-1',
    area_id: 'area-1',
    trade_name: 'Plumbing',
    assigned_to: 'user-1',
    assigned_to_name: 'Carlos',
    deadline: '2026-03-24',
    note: null,
    created_by: 'gc-1',
    created_at: '2026-03-21T10:00:00Z',
    status: 'open',
    ...overrides,
  };
}

function makeEvent(type: 'action:confirmed' | 'action:reverted'): ActionEvent {
  return {
    type,
    key: 'area-1:Plumbing',
    action: makeAction(),
    optimisticInsertedAt: Date.now() - 1500,
  };
}

// ─── Tests ───────────────────────────────────────────

describe('ActionEventBus', () => {
  let bus: ActionEventBusImpl;

  beforeEach(() => {
    bus = new ActionEventBusImpl();
  });

  it('emits events to all subscribers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.subscribe(handler1);
    bus.subscribe(handler2);

    const event = makeEvent('action:confirmed');
    bus.emit(event);

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it('unsubscribe prevents further calls', () => {
    const handler = vi.fn();
    const unsub = bus.subscribe(handler);

    bus.emit(makeEvent('action:confirmed'));
    expect(handler).toHaveBeenCalledOnce();

    unsub();
    bus.emit(makeEvent('action:reverted'));
    expect(handler).toHaveBeenCalledOnce(); // still 1
  });

  it('handler error does not crash other handlers', () => {
    const badHandler = vi.fn(() => {
      throw new Error('boom');
    });
    const goodHandler = vi.fn();

    bus.subscribe(badHandler);
    bus.subscribe(goodHandler);

    // Should not throw
    bus.emit(makeEvent('action:confirmed'));

    expect(badHandler).toHaveBeenCalledOnce();
    expect(goodHandler).toHaveBeenCalledOnce(); // still called despite bad handler
  });

  it('emitting with no subscribers is a no-op', () => {
    // Should not throw
    expect(() => bus.emit(makeEvent('action:reverted'))).not.toThrow();
  });

  it('multiple unsubscribes are idempotent', () => {
    const handler = vi.fn();
    const unsub = bus.subscribe(handler);

    unsub();
    unsub(); // double unsubscribe — should not throw

    bus.emit(makeEvent('action:confirmed'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('preserves event type discrimination', () => {
    const handler = vi.fn();
    bus.subscribe(handler);

    const confirmed = makeEvent('action:confirmed');
    const reverted = makeEvent('action:reverted');

    bus.emit(confirmed);
    bus.emit(reverted);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].type).toBe('action:confirmed');
    expect(handler.mock.calls[1][0].type).toBe('action:reverted');
  });
});
