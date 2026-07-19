import { describe, it, expect, vi, beforeEach } from 'vitest';

// NEXT_PUBLIC_API_URL is provided via vitest.config.ts `test.env` so that
// lib/api.ts (which reads it at import time) does not throw on import.

import {
  fetchPlanGenerationStatus,
  generatePersonalizedPlan,
  getApiErrorMessage,
} from '@/lib/api';

// ---- Minimal Response stub that lets us control `.ok` and `.json()` ----------
function makeResponse(opts: {
  ok: boolean;
  status: number;
  body: unknown;
}): Response {
  return {
    ok: opts.ok,
    status: opts.status,
    json: async () => opts.body,
  } as unknown as Response;
}

describe('getApiErrorMessage', () => {
  it('prefers a string `detail` field', async () => {
    const res = makeResponse({
      ok: false,
      status: 429,
      body: { detail: 'You already generated an AI plan today.' },
    });
    expect(await getApiErrorMessage(res, 'fallback')).toBe(
      'You already generated an AI plan today.'
    );
  });

  it('prefers a string `message` field when no `detail`', async () => {
    const res = makeResponse({
      ok: false,
      status: 400,
      body: { message: 'bad input' },
    });
    expect(await getApiErrorMessage(res, 'fallback')).toBe('bad input');
  });

  it('falls back for 5xx', async () => {
    const res = makeResponse({ ok: false, status: 500, body: {} });
    expect(await getApiErrorMessage(res)).toMatch(/having trouble/);
  });

  it('falls back for 404', async () => {
    const res = makeResponse({ ok: false, status: 404, body: {} });
    expect(await getApiErrorMessage(res, 'my fallback')).toBe("That StackSmart API route was not found. Please refresh and try again.");
  });

  it('uses the supplied fallback for other client errors', async () => {
    const res = makeResponse({ ok: false, status: 403, body: {} });
    expect(await getApiErrorMessage(res, 'my fallback')).toBe('my fallback');
  });
});

describe('fetchPlanGenerationStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GETs the status endpoint with a bearer token and returns the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        ok: true,
        status: 200,
        body: { limit: 1, used_today: false, generation: null },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPlanGenerationStatus('tok-abc');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/plan/generate/status');
    expect(init.headers.Authorization).toBe('Bearer tok-abc');
    expect(init.method ?? 'GET').toBe('GET');
    expect(result).toEqual({ limit: 1, used_today: false, generation: null });
  });

  it('throws an Error including the API detail on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        ok: false,
        status: 429,
        body: { detail: 'You already generated an AI plan today.' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPlanGenerationStatus('tok-abc')).rejects.toThrow(
      /already generated an AI plan today/i
    );
  });
});

describe('generatePersonalizedPlan', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs the payload with JSON + bearer headers and returns the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({ ok: true, status: 200, body: { portfolio_name: 'Plan' } })
    );
    vi.stubGlobal('fetch', fetchMock);

    const payload = { monthly_investment_amount: 500 };
    const result = await generatePersonalizedPlan(payload, 'tok-xyz');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/plan/generate');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer tok-xyz');
    expect(init.body).toBe(JSON.stringify(payload));
    expect(result).toEqual({ portfolio_name: 'Plan' });
  });

  it('throws on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        ok: false,
        status: 500,
        body: { detail: 'AI plan generation is unavailable right now.' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(generatePersonalizedPlan({}, 'tok-xyz')).rejects.toThrow(
      /unavailable right now/i
    );
  });
});
