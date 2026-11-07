# OpenRouter financial plans

StackSmart uses OpenRouter chat completions with `nvidia/nemotron-3-ultra-550b-a55b:free`. Requests enforce a zero prompt/completion price ceiling. There is no alternate-model or paid fallback, and no application daily generation quota. Provider availability and limits still apply.

## Setup

Set backend-only variables in `stacksmart/backend/.env` (never commit the key):

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
ENABLE_AI_FINANCIAL_PLANS=false
```

Enable AI for synthetic-data testing with `ENABLE_AI_FINANCIAL_PLANS=true`. Disabled mode returns an explicitly labelled rule-based plan. Old `GEMINI_*`, `ENABLE_GEMINI_FINANCIAL_PLANS`, and `OPENROUTER_FALLBACK_MODEL` variables are not used. No provider key belongs in frontend variables.

## Data policy and public launch

The selected free endpoint asks callers not to submit personal or confidential data and logs usage for security and product improvement. Use synthetic financial information only, including synthetic loans and notes. Keep real customer financial data out of this endpoint. Before onboarding real users, select an appropriate provider/data-processing policy and review the integration against it; removing app quotas does not resolve this restriction.

Provider terms: [Nemotron free endpoint](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free).

## Request and validation

One shared prompt supplies the current validated user inputs, existing holdings, liquidity needs, server-calculated budget, an approved ETF menu, and verified stock context when available. User notes are data, not instructions. The request uses `submit_financial_advice` tool calling; the endpoint advertises tools and named function choice, but not strict `response_format` support.

The model proposes a small ETF mix and concise explanations. Server validation controls tickers, totals, near-term liquidity exposure, and budget consistency. Dollar amounts and projections stay server-calculated. The stock research idea is separate, with zero allocation and dated supporting context; unavailable or stale source data yields an explicit unavailable state.

No request is silently routed to another model. Provider failures remain errors rather than AI-labelled rule-based success. Safe correlation references and error categories help trace failures without logging financial inputs, raw model output, or credentials. Provider requests use a 5-second connection and 60-second read timeout. Planning database requests have a 5-second transport timeout without automatic retries. The browser waits up to 120 seconds and never automatically resubmits a generation POST. These transport timeouts are inactivity limits rather than a strict wall-clock deadline.

Generation reads available in-memory ETF quote data without starting a live Yahoo download after the AI response. When no cached quote exists, the result clearly labels prices as illustrative and suppresses synthetic return figures. Expense ratios are static/cached planning assumptions to verify against current fund prospectuses. Current quote refresh remains a separate market-data operation; prices do not determine the server-calculated monthly dollar split.

## Database rollout

Apply the new unlimited-generation migration before deploying the updated backend. It removes daily slot constraints while preserving generation history and service-role-only access. Do not deploy code expecting UUID-only tracking against the legacy daily-slot schema. See [AI database review](AI-DATABASE-REVIEW.md) for schema recommendations and rollout verification.

## Investigation evidence

During this task, authenticated synthetic requests to the exact Nemotron model succeeded for a minimal message, a forced function call, and the original full advice schema. The original full-schema response validated with six cards in about 26 seconds. These checks confirm the route and request shape can work; they do not reproduce or establish the cause of earlier failures.

References: [OpenRouter API](https://openrouter.ai/docs/api/reference/overview), [model endpoint metadata](https://openrouter.ai/api/v1/models/nvidia/nemotron-3-ultra-550b-a55b:free/endpoints).
