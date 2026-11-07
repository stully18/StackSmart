# Goal projection math

## Inputs and interpretation

The screen has two required inputs (monthly amount and risk) and one optional goal box. No saved profile or loan data is loaded. Goal text is bounded to 500 characters and is treated as untrusted context. Parsing is deterministic: one explicit USD amount and one explicit relative timeframe, such as `$40,000 for a house down payment in 5 years`. Shorthand dollar amounts and common relative durations are supported. Ambiguous values, unstated prices, absolute calendar deadlines, existing balances, and target ages are not inferred. The UI displays the interpreted amount and duration so the user can review them. Goals without a clear target/deadline receive generic 1/3/5-year illustrations and guidance to supply the missing values.

A recognized spending need within 36 months, or explicit near-term/emergency liquidity language, selects savings even if risk tolerance is high. This is a simple liquidity guard, not a complete financial assessment.

## Formula

All calculations run in backend Python. The language model provides ETF selections and wording, never projection values or return assumptions.

Starting balance is zero. For monthly contribution P, nominal annual rate R (decimal), monthly rate r = R / 12, and n whole months, with deposits at the end of each month:

`FV = P * ((1 + r)^n - 1) / r`

At R = 0, `FV = P * n`. At n = 0, FV = 0; at n = 1, FV = P. Implementation uses `expm1(n * log1p(r)) / r` for numerical stability, with explicit boundary handling.

Deposited principal = P * n. Estimated growth = FV - deposited principal. Final display values are rounded to cents. Goal shortfall = max(target - displayed balance, 0).

For a stated positive deadline, required monthly contribution = target / annuity factor. A 45-digit Decimal month-by-month recurrence computes that factor independently, then the contribution is rounded upward to the nearest cent. Target attainment uses a bounded binary search for the first month whose cent-rounded balance reaches the target. Estimates beyond 600 months are explicitly reported as outside the model, never as impossible forever. An immediate goal cannot be funded with future deposits.

## Rates and limitations

The savings scenario assumes 3% nominal annual interest, compounded monthly. It is an illustrative assumption, not a quoted current savings APY. APY already incorporates compounding: the effective annual yield corresponding to a nominal monthly-compounded R is `(1 + R/12)^12 - 1`. The screen does not divide an advertised APY by 12.

ETF nominal annual return assumptions are owned by server code and weighted by the actual cent-rounded monthly dollar allocations. Projection calculations use the exact nominal rate displayed (four percentage decimals). This models a constant blended portfolio return and does not simulate individual price paths. Return assumptions are not current yields or forecasts. Contributions and all growth remain invested. Taxes, fees, inflation, changes in rates/returns, home/car price changes, financing, closing costs, and withdrawals are excluded. Losses are possible; these figures are not guarantees of investment performance or purchase affordability.

References: [SEC compound-interest calculator](https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator), [CFPB explanation of compound interest](https://www.consumerfinance.gov/ask-cfpb/how-does-compound-interest-work-en-1683/), [CFPB APY calculation definition](https://www.consumerfinance.gov/rules-policy/regulations/1030/a/).

## Verification

The final focused backend suite passed 115 tests; 18 frontend tests and the production build also passed. The backend suite includes an independent high-precision Decimal monthly-balance recurrence across 0/1/12/60/600 months and negative, zero, very small, and positive rates. It checks exact goal boundaries, cent rounding, required payments, first-month attainment, malformed/ambiguous goal text, no invented targets, near-term savings overrides, and ignoring AI-supplied projection fields.

Frontend checks cover optional-goal trimming/limits. Desktop/mobile Playwright checks exercise the actual component with compiled styles and synthetic auth/API responses, optional/omitted goals, server fixture amounts, target comparison, no overflow, error recovery, and signed-out redirect behavior. This is isolated component verification, not a deployed or Next.js route-level check. Live synthetic OpenRouter goal requests passed; the backend computed their resulting projections locally. No production deployment or SQL migration was performed for this follow-up.
