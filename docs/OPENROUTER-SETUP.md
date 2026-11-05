# OpenRouter financial plans

The backend uses OpenRouter chat completions with `nvidia/nemotron-3-ultra-550b-a55b:free`. Requests set a zero prompt/completion price ceiling. An optional `OPENROUTER_FALLBACK_MODEL=openrouter/free` keeps generation available when Nemotron times out or returns invalid advice. Leaving the fallback variable empty keeps Nemotron as the only model. The existing plan schema, deterministic baseline, validation, authentication, and per-user daily reservations remain in place. Provider failures release the reservation through the API error path.

## Local setup

Set these values in `stacksmart/backend/.env` (never commit the key):

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_FALLBACK_MODEL=openrouter/free
ENABLE_AI_FINANCIAL_PLANS=false
```

For synthetic-data integration testing, set `ENABLE_AI_FINANCIAL_PLANS=true` and restart the backend. When disabled, the endpoint returns the rule-based plan. When enabled, missing keys, rate limits, timeouts, and invalid model output surface as generation failures instead of silently returning an AI-labelled fallback. Existing `GEMINI_*` and `ENABLE_GEMINI_FINANCIAL_PLANS` settings are no longer used. Configure the same backend-only variables on the hosting service when ready; no frontend key is needed.

## Advice contract and timeouts

The API sends authenticated POST requests to `https://openrouter.ai/api/v1/chat/completions` with system/user messages and a `submit_financial_advice` function schema. The model returns six to eight concise advice cards, assumptions, warnings, and an optional monthly action plan. StackSmart calculates ETF allocations, prices, and projections; the model does not regenerate those fields. Extended reasoning is disabled for both preferred and fallback requests so the output budget remains available for structured advice. Tool arguments (or JSON text) are validated before merging into the calculated plan, and monthly advice cannot allocate more than the user's budget. The usage ledger records the model route that actually generated advice.

With a fallback configured, the preferred request has a 20-second read timeout and the fallback has a 40-second read timeout; both have a 10-second connection timeout. Without fallback, the read timeout is 45 seconds. These are HTTP inactivity limits, not a total wall-clock deadline. Blocking market/provider work runs in a worker thread so it does not block the API event loop. The browser stops waiting after 90 seconds and explains connection/timeouts; the API returns specific 502/503/504 JSON errors and releases failed generation reservations. A timed-out browser request is not automatically retried, avoiding duplicate generations.

## Provider data restriction

The selected free endpoint explicitly says not to submit personal or confidential information and describes logging for security and product improvement. Keep AI disabled for real user plans until an appropriate provider/data policy is selected. Do not use real saved loans, income, savings, or personal notes in free-endpoint tests. Disabled planning remains local to the StackSmart backend. No real provider request is required by the unit tests.

Sources: [model and free-endpoint terms](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free), [API reference](https://openrouter.ai/docs/api/reference/overview).
