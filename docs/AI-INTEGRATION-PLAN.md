# OpenRouter AI integration plan

## Intended behavior

Use OpenRouter with `nvidia/nemotron-3-ultra-550b-a55b:free`, one shared prompt template, and the user's current financial inputs on every generation. Return a small personalized ETF allocation with percentages, monthly amounts, and short explanations, plus one separate individual-stock research idea. Remove application generation quotas for live testing. Keep authentication and data ownership protections.

Work on `dev`. Merge into `main` only on the user's explicit instruction.

## Investigation findings

- The repository already calls OpenRouter chat completions using the requested model. Gemini remains in outdated guidance and a historical database default, rather than the active provider call.
- `app/services/ai_financial_planner.py` owns the shared prompt and provider request. It sends current request inputs plus a deterministic portfolio and monthly cash allocation. The AI currently writes advice, not portfolio weights, and the prompt explicitly forbids stock ideas.
- The request forces a `submit_financial_advice` function call and disables reasoning. OpenRouter's live endpoint metadata lists tools and named function choice as supported. This does not establish why a particular request failed.
- Provider HTTP errors discard the response details; malformed output produces one generic error. Timeout, provider rejection, and response-validation failures need distinguishable server diagnostics.
- A configured fallback switches to another model after only 20 seconds; without it Nemotron gets 45 seconds. This can interrupt a slower successful generation and conflicts with the requested single-model behavior.
- Quotas exist in `ai_plan_limit.py`, the generation and status endpoints, frontend status state and button gating, and migration `004_raise_ai_plan_daily_limit.sql`. That migration constrains generation numbers to 1–10.
- The request schema already includes age, income, expenses, savings, emergency funds, loans, risk, goal, horizon, and notes. Structured existing holdings and specific money-needed dates/amounts are missing.
- Vercel MCP access worked. The latest returned production frontend deployment was READY on `main` at `b3e6f4e5a73adec2064797aa7b630375564c2c9c`. This is a deployment-status check, not a live AI-flow verification.
- No Railway MCP was exposed in this session. The authenticated Railway CLI listed the existing FratFinance service, matching the backend hostname in frontend configuration. Queries for AI-generation failures and OpenRouter messages returned no entries, so no live failure was reproduced or attributed. Supabase live schema was not inspected in this planning pass.

## Implementation sequence

### 1. Reproduce and diagnose the provider call

- Verify the target Railway environment, deployed revision, AI enable flag, exact model, fallback setting, and presence of the backend-only API key without exposing secret values.
- Send a minimal synthetic-data request to the exact Nemotron route, then the current tool schema, then one complete application request. Compare results to isolate authentication, routing, request parameters, output format, and timeout behavior.
- Log a correlation ID, model, elapsed time, HTTP status, safe provider error code/message, finish reason, and validation-error field paths. Redact keys, financial inputs, and raw advice. Give the UI a useful error category and correlation ID.
- Keep the current tool approach if the live call validates it. Adjust only parameters demonstrated to cause trouble; do not assume unsupported strict JSON-schema response mode.
- Use Nemotron only, with no silent paid or alternate-model fallback. Keep free-only routing. Choose timeouts based on measured latency and align backend and frontend handling. Bound retries to transient failures and prevent duplicate generation records.

### 2. Remove application quotas

- Replace numbered daily reservations with generation tracking by UUID. Remove quota rejection and capped status queries while preserving per-user ownership and useful completion/failure tracking.
- Inspect live schema and add an idempotent migration removing daily slot uniqueness and the 1–10 check as needed. Preserve existing history, RLS, grants, foreign keys, and relevant indexes; update the provider default to OpenRouter.
- Remove frontend daily-limit banners, local capped counters, and quota-based button disabling. Keep pending-request UI behavior.
- Retain the status endpoint only if useful, with an explicit unlimited contract and matching frontend types. Distinguish provider 429 responses from application quotas. OpenRouter's own limits remain outside the app's control.
- Update obsolete AGENTS.md quota/Gemini guidance and setup docs to reflect this explicitly requested change.

### 3. Supply current user context through one prompt

- Keep one versioned prompt template; pass validated user context as data on every request. User notes must not override application rules.
- Add structured existing holdings and liquidity needs: amount, date or time until needed, and purpose. Distinguish emergency cash, investable savings, and existing investments so projections do not invest the same dollars twice.
- Populate existing known fields from current form/profile/loan state and allow review before generation. Do not assume income is take-home income when the supplied field is gross.
- Explicitly represent unknown values and tell the model which facts are missing. Avoid fabricated personal facts, tax eligibility, prices, or current market claims.

### 4. Keep the ETF output small and personalized

- Proposed approved menu: VTI or VOO for the US equity core, VXUS for broad international exposure, and an appropriate defensive option for lower risk or nearer spending needs. Add a separate international fund only when it serves a distinct purpose.
- Treat VXUS as the working interpretation of the user's international ticker examples. It is Vanguard's Total International Stock ETF. VTI and VOO need not both appear in every plan; explain overlap if both are selected.
- Let the model propose holdings and weights within this menu, then validate tickers, finite nonnegative values, duplicate holdings, portfolio totals, and consistency with risk and liquidity constraints.
- Calculate dollars, rounding, projections, and budget reconciliation on the server. ETF allocations total 100% of the ETF sleeve; debt payments and emergency savings are separate parts of the overall budget.
- Money needed soon must affect the allocation, rather than merely adding a warning to an aggressive portfolio. International exposure is diversification, not an automatic higher-risk toggle.

### 5. Return one stock research idea

- Extend the provider response schema to accept exactly one structured idea: ticker, company, sector, reason, key risk, and dated supporting market context.
- Reuse an existing market-data seam to supply a verified candidate set and recent facts. Define sector relevance from that data; do not ask the model to invent which sector is currently popular.
- Default to a separate research card with zero budget allocation. This fulfills the stock-idea request without silently taking dollars from the ETF plan. Any later funded allocation must reconcile with the same total budget.
- If current evidence is unavailable, show an explicit unavailable state rather than fabricate a pick or call it current.

### 6. Verify and release

- Focused backend tests: provider success and errors, tool parsing, malformed/truncated responses, timeouts, exact model route, changed user context, invalid tickers/weights, budget reconciliation, and one valid stock idea.
- Verify more than ten successful generations for one synthetic test user, concurrent generation tracking, and preserved authentication/ownership. Check the migration against existing generation history.
- Verify the affected frontend form, error states, unlimited generation controls, ETF presentation, stock card, and mobile layout directly. Locate the required Playwright skill before UI work; report if unavailable.
- Commit the stable implementation on `dev`. When a deployment is triggered, inspect Railway and Vercel status/logs, confirm the intended revision and environment, and exercise the affected authenticated live flow. Do not merge or promote to production without the user's explicit main-merge instruction.

## Completion criteria

A live synthetic-user request uses the exact Nemotron model, produces a validated personalized ETF plan and one supported stock idea, accepts changed financial context, and works beyond ten generations. Dollars reconcile, near-term needs affect the plan, and provider errors are diagnosable. Relevant deployments and the affected live flow are verified.

## Reference checks

- OpenRouter model endpoints: https://openrouter.ai/api/v1/models/nvidia/nemotron-3-ultra-550b-a55b:free/endpoints
- OpenRouter API reference: https://openrouter.ai/docs/api/reference/overview
- Vanguard VXUS: https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf
