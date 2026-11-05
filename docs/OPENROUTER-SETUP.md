# OpenRouter financial plans

The backend uses OpenRouter chat completions with `nvidia/nemotron-3-ultra-550b-a55b:free`. Requests set a zero prompt/completion price ceiling and do not specify alternative models. The existing plan schema, deterministic baseline, validation, authentication, and per-user daily reservations remain in place. Provider failures release the reservation through the API error path.

## Local setup

Set these values in `stacksmart/backend/.env` (never commit the key):

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
ENABLE_AI_FINANCIAL_PLANS=false
```

For synthetic-data integration testing, set `ENABLE_AI_FINANCIAL_PLANS=true` and restart the backend. When disabled, the endpoint returns the rule-based plan. When enabled, missing keys, rate limits, timeouts, and invalid model output surface as generation failures instead of silently returning an AI-labelled fallback. Existing `GEMINI_*` and `ENABLE_GEMINI_FINANCIAL_PLANS` settings are no longer used. Configure the same backend-only variables on the hosting service when ready; no frontend key is needed.

## Provider data restriction

The selected free endpoint explicitly says not to submit personal or confidential information and describes logging for security and product improvement. Keep AI disabled for real user plans until an appropriate provider/data policy is selected. Do not use real saved loans, income, savings, or personal notes in free-endpoint tests. Disabled planning remains local to the StackSmart backend. No real provider request is required by the unit tests.

Sources: [model and free-endpoint terms](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free), [API reference](https://openrouter.ai/docs/api/reference/overview).
