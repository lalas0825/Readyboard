import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { orchestrateAction } from '../services/orchestrateAction';

// ─── Setup ───────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const payload = {
  event_type: 'corrective_action.created' as const,
  project_id: 'proj-1',
  action_id: 'act-1',
  delay_log_id: 'dl-1',
  area_id: 'area-1',
  trade_name: 'Plumbing',
  assigned_to: 'user-1',
  assigned_to_name: 'Carlos',
  deadline: '2026-03-24',
  note: null,
  status: 'open',
  created_by: 'gc-1',
  created_at: '2026-03-21T10:00:00Z',
  client_latency_ms: 1500,
};

// ─── Tests ───────────────────────────────────────────

describe('orchestrateAction', () => {
  it('skips silently when WEBHOOK_ACTION_URL is not set', async () => {
    vi.stubEnv('WEBHOOK_ACTION_URL', '');

    await orchestrateAction(payload);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends correct JSON payload on success', async () => {
    vi.stubEnv('WEBHOOK_ACTION_URL', 'https://hooks.example.com/test');
    mockFetch.mockResolvedValueOnce({ ok: true });

    await orchestrateAction(payload);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://hooks.example.com/test');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body);
    expect(body.event_type).toBe('corrective_action.created');
    expect(body.source).toBe('readyboard');
    expect(body.version).toBe('1.0');
    expect(body.project_id).toBe('proj-1');
    expect(body.action_id).toBe('act-1');
    expect(body.trade_name).toBe('Plumbing');
    expect(body.timestamp).toBeDefined();
  });

  it('does not retry on 4xx errors', async () => {
    vi.stubEnv('WEBHOOK_ACTION_URL', 'https://hooks.example.com/test');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    await orchestrateAction(payload);

    expect(mockFetch).toHaveBeenCalledOnce(); // no retry
  });

  it('retries on 500 with exponential backoff', async () => {
    vi.stubEnv('WEBHOOK_ACTION_URL', 'https://hooks.example.com/test');
    vi.useFakeTimers();

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true });

    const promise = orchestrateAction(payload);

    // First attempt fires immediately, then waits 1s backoff
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('gives up after 3 failed attempts', async () => {
    vi.stubEnv('WEBHOOK_ACTION_URL', 'https://hooks.example.com/test');
    vi.useFakeTimers();

    mockFetch
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'));

    const promise = orchestrateAction(payload);

    // Advance through all backoffs: 1s + 2s
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });
});
