# AI integration security and code review

## Review scope

Two implementation agents owned backend/database and frontend work. A separate review agent then inspected the complete implementation diff and surrounding provider, auth, ownership, financial-validation, and database paths. The review used static analysis and focused offline probes. It is not a full application penetration test or certification of the hosted Supabase schema.

## Findings addressed before commit

1. Nested loan values did not inherit the parent request's finite-number configuration. Planning now uses bounded, finite loan fields and bounded loan counts/names. Invalid input is rejected with a safe HTTP 422 before storage/provider work; valid zero-balance and deferred-payment saved loans remain accepted.
2. The capital-preservation goal lacked a mandatory defensive allocation, and disabled-mode portfolios did not distinguish financial goals. Server constraints and deterministic fallback now respect goals as well as risk/horizon, with an 80% defensive minimum for capital preservation.
3. Provider, quote-fetch, and database work could exceed the browser's timeout. Provider requests now use 5-second connection/60-second read timeouts, and planning database requests use a 5-second timeout without retries. Generation reads cached or explicitly illustrative quotes instead of starting live Yahoo downloads. These are transport inactivity limits, not a hard wall-clock deadline. No automatic generation POST retries are added.

These findings were returned to the backend implementation agent for correction and regression tests. The independent reviewer checked the fixes and closed all three findings. The final focused backend suite passed 62 tests; frontend checks and local SQL verification are recorded in the implementation plan.

## Existing launch blockers outside the AI changes

- **Plaid authentication and token ownership:** `app/main.py` has Plaid link/exchange/balance/transaction routes without bearer-token dependencies. Link creation trusts a client-supplied user ID, token exchange returns the long-lived access token to the frontend, and downstream calls accept client-supplied access tokens. Investment-related token flows also need the same ownership review. Before real banking users, move item tokens behind authenticated backend-owned records, derive identity from verified sessions, and require owner-scoped item/account lookup on every operation.
- **Plaid token storage:** the original `plaid_accounts` schema declares a text token column and an owner-readable SELECT policy. Encryption and deployed grants cannot be inferred from a SQL comment. Verify actual storage and grants, separate backend-only item secrets from client-safe account metadata, and adopt deliberate key management. This change does not migrate or repair Plaid token flows.
- **Free-provider data policy:** the selected Nemotron free route asks callers not to send personal/confidential data. This implementation is for synthetic testing. Select an appropriate data-processing policy before processing real customer financial information.
- **Hosted schema verification:** Supabase MCP failed and the CLI lacked authentication. The migration was verified in isolated PostgreSQL but was not applied to the hosted database. Live RLS policies, grants, privileged function EXECUTE permissions, and advisors still need verification once the project connection is restored.

## Security properties retained

Generation routes still require a verified Supabase bearer token. The API takes generation ownership from that token, not a client-supplied user ID. The new status query is owner-scoped and bounded to metadata; public roles receive no direct generation-table CRUD grants in the migration. New generation rows avoid duplicating financial input/output snapshots. UUID identities eliminate numbered-slot races. Provider output is validated against a limited ETF menu, financial constraints, and verified stock context; no provider error body or raw financial prompt is logged.

The review found no new authorization bypass, unsafe HTML rendering, SQL string interpolation, or credential exposure in the implementation. That result is limited to the reviewed paths and available evidence.

See [database review](AI-DATABASE-REVIEW.md) for normalization, retention, indexing, and scaling recommendations, and [implementation plan](AI-INTEGRATION-PLAN.md) for test evidence and deployment limits.
