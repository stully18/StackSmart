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

The selected free endpoint asks callers not to submit personal or confidential data and logs usage for security and product improvement. Use synthetic monthly budgets only. Keep real customer financial data out of this endpoint. Before onboarding real users, select an appropriate provider/data-processing policy and review the integration against it; removing app quotas does not resolve this restriction.

Provider terms: [Nemotron free endpoint](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free).

## Two-input screen and prompt

`POST /api/plan/generate` now accepts only `monthly_investment_amount` and `risk_tolerance` (`conservative`, `moderate`, or `aggressive`). Other fields are rejected rather than silently loading or forwarding financial context. The screen does not read saved loans, profiles, holdings, goals, notes, or income.

Low risk returns a server-calculated high-yield savings recommendation without contacting the AI provider or inventing a bank/APY. It asks users to verify FDIC coverage, fees, and the current variable rate. The usage record correctly labels that result as rule-based.

For balanced and higher risk, one short shared prompt supplies only the two input values, server risk constraints, and verified stock-screen context when eligible. Nemotron returns a one- or two-sentence summary and two or three ETF allocations with short explanations. Balanced excludes individual stocks; higher risk permits one separate, unfunded research idea only when verified recent evidence is available. No stock is invented when the cache is empty.

The response parser retains the established financial result contract for internal compatibility, but the page shows only the summary, savings or ETF option cards, and the eligible stock idea. Advice dashboards, optional inputs, projections, missing-data tables, price/fee statistics, brokerage links, and debt/emergency sections are removed from this screen. Legacy detailed calculation helpers remain tested internally; they are not populated by this public request.

The model's tool schema no longer asks for advisor cards or assumptions. Server validation still controls allowed tickers, finite percentages, duplicate/overlapping funds, risk minimums, and totals. Dollar amounts remain server-calculated. The endpoint uses `submit_financial_advice` tool calling; it does not request unsupported strict `response_format`.

No request is silently routed to another model. Provider failures remain errors rather than AI-labelled rule-based success. Safe correlation references and error categories help trace failures without logging financial inputs, raw model output, or credentials. Provider requests use a 5-second connection and 60-second read timeout. Planning database requests have a 5-second transport timeout without automatic retries. The browser waits up to 120 seconds and never automatically resubmits a generation POST. These transport timeouts are inactivity limits rather than a strict wall-clock deadline.

Generation reads available in-memory ETF quote data without starting a live Yahoo download after the AI response. When no cached quote exists, the result clearly labels prices as illustrative and suppresses synthetic return figures. Expense ratios are static/cached planning assumptions to verify against current fund prospectuses. Current quote refresh remains a separate market-data operation; prices do not determine the server-calculated monthly dollar split.

## Database rollout

Apply the new unlimited-generation migration before deploying the updated backend. It removes daily slot constraints while preserving generation history and service-role-only access. Do not deploy code expecting UUID-only tracking against the legacy daily-slot schema. See [AI database review](AI-DATABASE-REVIEW.md) for schema recommendations and rollout verification.

## Investigation evidence

During this task, authenticated synthetic requests to the exact Nemotron model succeeded for a minimal message, a forced function call, and the original full advice schema. The original full-schema response validated with six cards in about 26 seconds. These checks confirm the route and request shape can work; they do not reproduce or establish the cause of earlier failures.

References: [OpenRouter API](https://openrouter.ai/docs/api/reference/overview), [model endpoint metadata](https://openrouter.ai/api/v1/models/nvidia/nemotron-3-ultra-550b-a55b:free/endpoints).

## Simplified-screen verification

The two-input follow-up passed 66 focused backend tests, 16 frontend tests, and the production build with TypeScript validation. Live synthetic Nemotron requests for balanced and higher risk returned validated, short ETF options in about two seconds each. Low-risk savings and no-provider-call behavior are covered by backend tests.

Desktop/mobile Playwright checks exercised the actual page component with compiled app CSS and synthetic auth/API responses: all risk paths, exact two-field payloads, no optional controls, no automatic generation, error recovery, auth redirect behavior, and no horizontal overflow or page errors. The local production server could not be started because automatic approval review rejected that action as blocked by policy; isolated component inspection was used instead. This does not constitute a Next.js route-level or deployed end-to-end test. Screenshots were visually inspected. No deployment, SQL change, or merge to main was performed for this follow-up.
