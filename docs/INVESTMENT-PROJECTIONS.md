# Goal projection math

## Inputs and interpretation

The screen has two required inputs (monthly amount and risk) and one optional goal box. No saved profile or loan data is loaded. Goal text is bounded to 500 characters and is treated as untrusted context. Parsing is deterministic: one explicit USD amount and one explicit relative timeframe, such as `$40,000 for a house down payment in 5 years`. Single unmarked USD targets such as 20000 for a car, shorthand amounts such as 30 grand, 30k, and 30 thousand, and common relative durations are supported. Ambiguous values, unstated prices, absolute calendar deadlines, existing balances, and target ages are not inferred. The UI displays the interpreted amount and duration so the user can review them. Goals without a clear target/deadline receive generic 1/3/5-year illustrations and guidance to supply the missing values.

Low risk selects rule-based savings. Balanced and higher risk retain their selected risk level and call AI even for a short goal. A server-owned warning explains the conflict between a deadline within three years and possible ETF losses; it does not silently change the selected risk. Projection math remains deterministic and does not raise return assumptions to make a target appear achievable.

## Formula

All calculations run in backend Python. The language model provides ETF selections and wording, never projection values or return assumptions.

Starting balance is zero. For monthly contribution P, nominal annual rate R (decimal), monthly rate r = R / 12, and n whole months, with deposits at the end of each month:

`FV = P * ((1 + r)^n - 1) / r`

At R = 0, `FV = P * n`. At n = 0, FV = 0; at n = 1, FV = P. Implementation uses `expm1(n * log1p(r)) / r` for numerical stability, with explicit boundary handling.

Deposited principal = P * n. Estimated growth = FV - deposited principal. Final display values are rounded to cents. Goal shortfall = max(target - displayed balance, 0).

For a stated positive deadline, required monthly contribution = target / annuity factor. A 45-digit Decimal month-by-month recurrence computes that factor independently, then the contribution is rounded upward to the nearest cent. Target attainment uses a bounded binary search for the first month whose cent-rounded balance reaches the target. Estimates beyond 600 months are explicitly reported as outside the model, never as impossible forever. An immediate goal cannot be funded with future deposits.

## Rates and limitations

The savings scenario assumes 3% nominal annual interest, compounded monthly. It is an illustrative assumption, not a quoted current savings APY. APY already incorporates compounding: the effective annual yield corresponding to a nominal monthly-compounded R is `(1 + R/12)^12 - 1`. The screen does not divide an advertised APY by 12.

US stock assumptions (VOO/VTI) use a 9.5% nominal annual illustration, about 9.92% effective annually with monthly compounding. This is an approximate long-term US stock historical reference, not a prediction for three years. VXUS remains 6%, BND 3.5%, and SGOV 2.5% nominal; these are chosen planning scenarios, not fund-specific historical statistics. For example, 60% US / 30% international / 10% SGOV gives 7.75% nominal, not a flat 10%. No random jitter or target-driven rate adjustment is used. VOO is preferred for aggressive US exposure, with VTI an alternative; they are not combined.

ETF nominal annual return assumptions are owned by server code and weighted by the actual cent-rounded monthly dollar allocations. Projection calculations use the exact nominal rate displayed (four percentage decimals). This models a constant blended portfolio return and does not simulate individual price paths. Return assumptions are not current yields or forecasts. Contributions and all growth remain invested. Taxes, fees, inflation, changes in rates/returns, home/car price changes, financing, closing costs, and withdrawals are excluded. Losses are possible; these figures are not guarantees of investment performance or purchase affordability.

Historical context: [Fidelity S&P 500 historical returns](https://www.fidelity.com/learning-center/trading-investing/sp-500-average-return) describes roughly 10% over long periods; [SEC investing introduction](https://www.investor.gov/introduction-investing) discusses 7?10% as a useful long-term historical estimate, and [SEC asset allocation guidance](https://www.investor.gov/additional-resources/general-resources/publications-research/info-sheets/beginners-guide-asset) emphasizes stock volatility over short periods.

References: [SEC compound-interest calculator](https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator), [CFPB explanation of compound interest](https://www.consumerfinance.gov/ask-cfpb/how-does-compound-interest-work-en-1683/), [CFPB APY calculation definition](https://www.consumerfinance.gov/rules-policy/regulations/1030/a/).

## Verification

The goal-input and risk-selection fix passed 124 focused backend tests; 18 frontend tests and the production build also passed. The backend suite includes an independent high-precision Decimal monthly-balance recurrence across 0/1/12/60/600 months and negative, zero, very small, and positive rates. It checks exact goal boundaries, cent rounding, required payments, first-month attainment, malformed/ambiguous goal text, no invented targets, short-deadline risk preservation with warnings, and ignoring AI-supplied projection fields.

Frontend checks cover optional-goal trimming/limits. Desktop/mobile Playwright checks exercise the actual component with compiled styles and synthetic auth/API responses, optional/omitted goals, server fixture amounts, target comparison, no overflow, error recovery, and signed-out redirect behavior. This is isolated component verification, not a deployed or Next.js route-level check. Live synthetic OpenRouter goal requests passed; the backend computed their resulting projections locally. No production deployment or SQL migration was performed for this follow-up.

The car-goal regression (30 grand in two years, $1,000/month, higher risk) was also checked against the live fixed Nemotron model using synthetic inputs and quotes. The actual React component was visually checked on desktop/mobile with that returned plan; this is an isolated component check, not a deployed route check. No deployment or database change was made for this fix.

The return-reference update also verified the exact synthetic 20000 car / three years / $300 monthly case against live Nemotron. It returned VOO60/VXUS30/SGOV10; server math used 7.75% nominal and produced $12,114.93, a $7,885.07 shortfall and $495.26 required monthly contribution. Independent Decimal recurrence and actual component desktop/mobile checks passed. No deployment or merge was performed for this update.


## Growth timeline

The API retains 1/3/5-year milestones and adds 10/15/20/30 years plus annual chart samples from year 0 through 30. Every sample uses the same server formula and actual monthly allocation amount. Goal deadlines remain separate, including deadlines beyond the plotted 30 years. The compact UI selects the goal deadline initially (or 10 years without a deadline); timeframe buttons switch one balance/contribution/growth summary rather than adding multiple cards. A subtle SVG compares the total balance with contributed principal; figures remain readable without the chart. Long-term views assume the user continues monthly contributions and makes no withdrawal at the goal date. This is not a simulation of actual market paths.

Timeline verification: 128 focused backend tests, 18 frontend tests, and production build passed. Independent Decimal monthly recurrence checked all annual samples for positive, zero, and negative rates; goal and milestone values reconcile. Isolated actual-component Playwright checks selected every 5/10/15/20/30-year button across three risk paths, compared balances and deposits with server fixtures, checked the chart, mobile overflow, error recovery, and auth redirect. Desktop/mobile screenshots were visually inspected. No live deployment or SQL change was made for the timeline task.
