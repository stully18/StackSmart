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
        body: { limit: 10, used_count: 0, remaining: 10, used_today: false, generation: null },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPlanGenerationStatus('tok-abc');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/plan/generate/status');
    expect(init.headers.Authorization).toBe('Bearer tok-abc');
    expect(init.method ?? 'GET').toBe('GET');
    expect(result).toEqual({ limit: 10, used_count: 0, remaining: 10, used_today: false, generation: null });
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

  it('round-trips the rich advisor dashboard payload unchanged', async () => {
    const richBody = {
      portfolio_name: 'AI Goal-Based Growth Plan',
      risk_profile: 'Aggressive, goal-aware',
      target_allocation: [],
      monthly_investment_breakdown: {},
      projected_value_1yr: 12000,
      projected_value_5yr: 80000,
      projected_value_10yr: 210000,
      projected_value_20yr: 800000,
      projected_value_30yr: 1800000,
      expected_annual_return: 8.1,
      portfolio_expense_ratio: 0.05,
      rebalancing_frequency: 'Quarterly',
      reasoning: ['Goal and risk tolerance support growth tilt.'],
      next_steps: ['Automate monthly investing.'],
      warnings: ['Educational guidance only.'],
      advisor_summary: 'Prioritize investing while keeping liquidity safe.',
      advisor_cards: [
        {
          title: 'Investing Priority',
          priority: 1,
          category: 'investing',
          recommendation: 'Invest most of the monthly surplus into diversified ETFs.',
          rationale: 'The user selected aggressive risk and income generation.',
          action_items: ['Set up recurring contributions.'],
          monthly_amount: 800,
          confidence: 'high',
        },
        {
          title: 'Satellite Idea',
          priority: 2,
          category: 'satellite_stock',
          recommendation: 'Small optional satellite pick.',
          rationale: 'Optional tilt.',
          action_items: [],
          confidence: 'low',
        },
      ],
      monthly_action_plan: {
        available_monthly_amount: 1000,
        etf_investing_amount: 800,
        debt_extra_payment_amount: 100,
        emergency_fund_amount: 100,
        notes: ['Only shown because income/expense context exists.'],
      },
      satellite_stock_ideas: [
        {
          ticker: 'AAPL',
          name: 'Apple Inc.',
          allocation_percent: 3,
          monthly_amount: 30,
          reason: 'Optional satellite exposure, not core allocation.',
          risk_note: 'Single-stock risk; cap total satellite exposure.',
        },
      ],
      advisor_assumptions: {
        confidence: 'medium',
        data_used: ['loans', 'income', 'goal', 'emergency fund'],
        missing_data: ['tax filing status'],
        caveats: ['No professional advice.'],
      },
      plan_source: 'ai',
    };

    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({ ok: true, status: 200, body: richBody })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await generatePersonalizedPlan(
      { monthly_investment_amount: 1000 },
      'tok-ai'
    );

    // generatePersonalizedPlan returns the parsed JSON verbatim, so rich
    // advisor fields must survive the round-trip untouched.
    expect(result).toEqual(richBody);
    expect(result.advisor_summary).toBe('Prioritize investing while keeping liquidity safe.');
    expect(result.advisor_cards).toHaveLength(2);
    expect(result.advisor_cards[0]).toMatchObject({
      priority: 1,
      category: 'investing',
      monthly_amount: 800,
      confidence: 'high',
    });
    expect(result.monthly_action_plan.etf_investing_amount).toBe(800);
    expect(result.satellite_stock_ideas[0]).toMatchObject({
      ticker: 'AAPL',
      allocation_percent: 3,
      risk_note: 'Single-stock risk; cap total satellite exposure.',
    });
    expect(result.advisor_assumptions).toMatchObject({
      confidence: 'medium',
      data_used: ['loans', 'income', 'goal', 'emergency fund'],
      missing_data: ['tax filing status'],
    });
    expect(result.plan_source).toBe('ai');
  });
});
