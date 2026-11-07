# OpenRouter AI integration plan

Current follow-up: the screen has monthly amount and risk, one optional goal box, and deterministic goal projections. The earlier detailed-context plan below is historical. See [current request and prompt contract](OPENROUTER-SETUP.md#two-input-screen-and-prompt).

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

## Two-agent implementation split

### Agent 1: Backend and database

Own backend schemas, planner/provider integration, unlimited generation tracking, SQL migration, and focused backend tests. Implement the shared input/output contract below. Review related database tables for RLS, grants, ownership, indexes, and unnecessary duplication; document broader improvements rather than performing unrelated table redesigns.

### Agent 2: Frontend and user context

Own frontend form, current context submission, result presentation, unlimited controls, TypeScript types, and focused frontend checks. Preserve auth loading before redirects and inspect the affected desktop/mobile flow. Coordinate contract questions with Agent 1.

### Shared API contract

- Add optional `existing_holdings: [{ticker, current_value}]` and `liquidity_needs: [{amount, months_until_needed, purpose}]` to `PersonalizedPlanRequest`; arrays default empty. Existing fields remain compatible.
- Keep current result fields and add `stock_idea_status` (`available` or `unavailable`) plus optional `stock_idea_message`. `satellite_stock_ideas` contains at most one zero-allocation research idea with existing fields plus `sector`, `as_of`, and `supporting_context`.
- Generation status reports `unlimited: true`, `limit: null`, `remaining: null`, and `used_today: false`; preserve a useful `used_count` and latest generation metadata without financial payloads.
- Errors preserve the existing `detail` string contract and include a safe category/correlation reference in the message.

After the two implementation agents finish, a separate review agent checks the complete diff for correctness, security, database integrity, and missing tests. The primary agent integrates changes, resolves findings, verifies live provider behavior where access allows, and makes one task commit on `dev`.

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

## Implementation and verification record

The two implementation sections above were assigned to separate backend/database and frontend agents. An independent security/code reviewer checked the implementation and its corrective changes, closing three findings before commit. The resulting implementation keeps one prompt and the exact free Nemotron model, supports structured current holdings and upcoming spending, validates proposed ETF weights, and returns a verified zero-budget stock research idea or an explicit unavailable state. Application quotas are removed; the generation ledger records metadata rather than new copies of financial inputs/results.

- The final 62 focused backend tests passed, covering provider parsing/errors, risk/goal and liquidity constraints, budget reconciliation, UUID tracking beyond ten requests, concurrent IDs, bounded user-scoped status, authenticated endpoints, safe invalid-input responses, valid paid/deferred saved loans, non-retrying short storage transports, cached-only quotes, and existing stock-query behavior. One upstream TestClient deprecation warning remains.
- Eight focused frontend tests passed. Frontend checks cover validated current-context submission, unlimited controls, result states, error recovery, and auth routing. TypeScript, production build, and direct desktop/mobile Playwright checks passed, including twelve successive submissions. The Playwright skill was unavailable; installed Playwright tooling was used. The browser checks used mocked auth/API responses and synthetic data, not a deployed backend.
- The migration was executed twice against isolated PostgreSQL via PGlite after migrations 003 and 004. It preserved a legacy financial payload row, allowed twelve additional same-user/day service-role inserts, kept RLS enabled, and denied CRUD grants to anon/authenticated.
- Live exact-model checks succeeded for a minimal message, forced function call, and original full advice schema. Updated-schema synthetic calls with illustrative market quotes succeeded for long/aggressive and short/conservative inputs (about 27 and 20 seconds). One short/conservative response was rejected by portfolio validation before a successful manual rerun; provider output is not guaranteed valid and failures remain explicit.
- Vercel MCP read access and Railway CLI access worked. The existing production services are on `main`; this task does not merge, publish, or deploy them. Supabase MCP returned Unknown tool; the Supabase CLI lacked an access token and Railway had no database connection string. An authenticated service-role REST schema probe succeeded, but cannot verify database policies or apply DDL. The new migration remains unapplied to the hosted project.
- The live stock-picks table was empty. The implementation therefore cannot produce a supported live stock idea until a recent eligible screen exists; no stock data was fabricated.
- A separate live tool-call check supplied an explicitly synthetic stock-screen fixture and illustrative quotes. Nemotron returned one validated research idea with zero allocated dollars in about 14 seconds. This validates the stock response contract, not the availability of real market evidence.
- After the review fixes, a live synthetic capital-preservation request validated in about 19 seconds with 90% defensive exposure (80% SGOV, 10% BND, 10% VTI), respecting the server's mandatory defensive minimum. No live quote refresh was performed during generation.
- The selected free provider's published restriction on personal/confidential data makes this a synthetic-testing integration. Review provider eligibility before accepting real customer financial information. See the database review for launch recommendations and the separate live-schema audit still required.


## Hosted migration follow-up

The restored Supabase MCP connection confirmed StackSmart's backend project as `FratFinance` (`nckejxsomqvwxovrcmyz`). Applied the committed `005_unlimited_ai_plan_generations.sql` through the migration tool as `unlimited_ai_plan_generations` after inspecting the live schema.

Verified all eight history rows were preserved; daily slot constraints were removed; the legacy slot column is nullable; the provider default is OpenRouter; the partial status index exists; and RLS remains enabled. `anon` and `authenticated` have no direct SELECT/INSERT/UPDATE/DELETE privileges, while `service_role` retains them. A rollback-only service-role transaction inserted thirteen generations successfully and left no test rows behind.

Security advisors before and after reported the same existing findings: mutable search paths for `set_updated_at` and `handle_new_user`, public-role EXECUTE access to the SECURITY DEFINER `handle_new_user` function, and disabled leaked-password protection. The no-policy notice on `market_data_cache` matches its intentional backend-only lockdown. No unrelated security settings/functions were changed. References: [search-path remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [privileged function access](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

This supersedes the earlier Supabase connection blocker. It verifies the generation table and migration, not all application policies or functions. Application code remains on `dev`; no application deployment or merge into `main` was performed. The currently deployed backend still has its old application quota until the new code is deployed.
