# StackSmart Agent Guide

## Workflow

- Always work on `dev`; never work directly on `main`.
- Merge `dev` into `main` only when the user explicitly asks. `main` deploys to Vercel.
- Keep changes focused and follow existing patterns.
- Make one commit per requested task once stable, using a Conventional Commit title.
- Include a short commit body stating what changed, why, and what verification was performed.
- Preserve unrelated working-tree changes.

## Repository Map

- `stacksmart/frontend/app`: Next.js App Router pages, layouts, auth, settings, and financial tools.
- `stacksmart/frontend/components`: shared feature components.
- `stacksmart/frontend/app/components`: application navigation, feedback, alerts, and landing-page components.
- `stacksmart/frontend/lib`: API helpers, Supabase client, auth helpers, and loan persistence.
- `stacksmart/frontend/types`: shared frontend types.
- `stacksmart/backend/app/main.py`: FastAPI app and API route wiring.
- `stacksmart/backend/app/services`: business logic and external-provider integrations.
- `stacksmart/backend/app/middleware/auth.py`: Supabase bearer-token verification.
- `stacksmart/backend/app/models`: API request and response schemas.
- `stacksmart/backend/app/jobs`: standalone Stock of the Day and market-data jobs.
- `stacksmart/backend/app/config/stock_watchlist.py`: Stock of the Day candidate universe.
- `stacksmart/backend/migrations`: manually applied Supabase SQL migrations.
- `stacksmart/backend/tests` and `stacksmart/frontend`: backend and frontend tests.
- `docs` and `stacksmart/docs`: setup, schema, and integration notes.

## Frontend Guidance

- Start route work in the relevant `app/**/page.tsx` and nearby layout.
- Shared auth and financial state are provided by `AuthContext` and `FinancialContext` in `app/context`.
- Auth uses Supabase client-side sessions stored in localStorage. The Next middleware is intentionally a no-op; protected pages gate access in their client components.
- When changing a protected page, preserve the loading-before-redirect flow to avoid auth races and double redirects.
- API calls use `NEXT_PUBLIC_API_URL`. Prefer `lib/api.ts` for shared API behavior; some existing flows call endpoints directly.
- Supabase browser access uses the public anon key. Never put service-role keys or other backend secrets in frontend code.
- For UI or UX changes, use the Playwright skill to open and visually inspect the affected route or flow. Verify only the affected flow unless broader coverage is requested.
- Follow existing Tailwind styles and check responsive behavior on changed screens.

## Backend Guidance

- Start API changes in `app/main.py`, then follow the request schema, service, and tests.
- Keep business logic in `services` where existing patterns allow; keep provider I/O behind existing client, fetcher, or cache seams.
- Authentication is applied to selected endpoints, not globally. Check the route’s dependencies before changing its behavior or describing it as protected.
- Treat Plaid access tokens, Supabase service-role credentials, and provider API keys as secrets. Review token ownership and authorization when changing Plaid flows.
- AI plan generation has per-user daily limits and reserves a slot before calling Gemini. Preserve failure cleanup and UTC-day behavior.
- Stock of the Day jobs run separately from FastAPI. Preserve their date, trading-day, idempotency, and persistence behavior when changing them.

## Database and Migrations

- Migrations are SQL applied manually; do not assume a migration CLI or unique numeric prefixes.
- Read related schema and setup documentation before changing database behavior.
- Preserve RLS, grants, ownership checks, and function security properties. Include explicit policies and grants in schema changes where needed.
- Prefer idempotent SQL when consistent with the existing migration and deployment approach.

## Verification

- Run the smallest relevant check; do not run broad suites by default.
- Frontend tests: `cd stacksmart/frontend && npm test`.
- Frontend production build: `cd stacksmart/frontend && npm run build`.
- Backend tests: `cd stacksmart/backend && pytest -q`.
- For auth, routing, or page-render changes, exercise the affected route or flow directly.
- For frontend UI or UX changes, complete the Playwright visual inspection described above.
- Report checks performed and any material limits in the final response.
