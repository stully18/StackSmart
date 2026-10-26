from __future__ import annotations

import json
import os
from typing import Any

from google import genai
from pydantic import ValidationError

from app.models.schemas import (
    AdvisorAssumptions,
    AdvisorCard,
    MonthlyActionPlan,
    PersonalizedPlanRequest,
    PersonalizedPlanResult,
)
from app.services import personalized_planner

# Model is env-configurable; default documents the current Flash model at
# implementation time. The exact default can be bumped via GEMINI_MODEL.
DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

SYSTEM_INSTRUCTIONS = """
You are StackSmart's financial advisor-style planning assistant. Produce educational, general financial planning guidance, not professional financial, tax, or legal advice.
Use the deterministic baseline as a guardrail, but do not merely restate it.
Prioritize the dashboard around investing and ETF allocation first, then debt and emergency fund guidance.
Broad diversified ETFs must remain the core allocation. Individual stocks are allowed only as small optional satellite stock ideas, capped at 10% total allocation.
Do not recommend crypto, leverage, options, day trading, or market timing.
Return only JSON matching the provided schema.
""".strip()


def _request_payload(request: PersonalizedPlanRequest, baseline: PersonalizedPlanResult) -> dict[str, Any]:
    return {
        "user_inputs": request.model_dump(mode="json"),
        "deterministic_baseline": baseline.model_dump(mode="json"),
        "requirements": [
            "Return 6 to 8 prioritized advisor cards.",
            "Put investing and ETF allocation first, then debt and emergency fund guidance.",
            "Make every card specific to the user's loans, income, goals, emergency fund, notes, or risk tolerance.",
            "If income, expenses, or loans are provided, include monthly_action_plan with dollar amounts; otherwise set monthly_action_plan to null (monthly_action_plan only when data exists).",
            "Core portfolio allocation should use broad diversified ETFs.",
            "Optional satellite stock ideas are allowed, but keep total satellite exposure at or below 10% and label risks clearly.",
            "Include advisor_assumptions with confidence, data_used, missing_data, and caveats.",
            "Keep target_allocation percentages positive and totaling approximately 100.",
            "Keep all projection numbers realistic and internally consistent.",
            "Include warnings for no emergency fund, high-interest loans, low savings, or short time horizons.",
            "Mention that this is educational guidance and the user should verify before acting.",
        ],
    }


def _sanitize_plan(plan: PersonalizedPlanResult, baseline: PersonalizedPlanResult) -> PersonalizedPlanResult:
    """Clamp obvious model mistakes while keeping Gemini's useful wording."""
    plan.plan_source = "ai"

    fallback_cards = [
        AdvisorCard(
            title="AI Portfolio Guidance",
            priority=1,
            category="investing",
            recommendation="Use the ETF allocation below as the core of the plan.",
            rationale="Gemini returned a valid portfolio plan, but StackSmart added this dashboard guardrail for clarity.",
            action_items=["Review the allocation", "Verify this plan before acting"],
            confidence="low",
        ),
        AdvisorCard(
            title="Core ETF Allocation",
            priority=2,
            category="etf_allocation",
            recommendation=f"Keep the diversified ETF allocation as the investable core of {plan.portfolio_name or baseline.portfolio_name}.",
            rationale="Broad low-cost ETFs should stay central before adding any satellite ideas.",
            action_items=["Compare ETF weights with your account holdings", "Rebalance on the suggested schedule"],
            confidence="medium",
        ),
        AdvisorCard(
            title="Risk Guardrails",
            priority=3,
            category="assumptions",
            recommendation="Treat this as educational guidance and confirm assumptions before acting.",
            rationale="AI output can miss personal tax, account, liquidity, or debt details.",
            action_items=["Check emergency savings", "Review debt rates", "Confirm tax/account fit"],
            confidence="low",
        ),
        AdvisorCard(
            title="Next Best Action",
            priority=4,
            category="goal",
            recommendation=(plan.next_steps[0] if plan.next_steps else "Set up the first recurring action from this plan."),
            rationale="A dashboard should turn the recommendation into a concrete next step.",
            action_items=plan.next_steps[:2] or ["Verify details", "Automate contributions"],
            confidence="medium",
        ),
        AdvisorCard(
            title="Projection Reality Check",
            priority=5,
            category="assumptions",
            recommendation="Use the projection numbers as planning estimates, not guaranteed outcomes.",
            rationale="Market returns, contribution consistency, taxes, and fees can materially change results.",
            action_items=["Stress-test lower returns", "Review the plan after major life changes"],
            confidence="medium",
        ),
        AdvisorCard(
            title="Portfolio Maintenance",
            priority=6,
            category="investing",
            recommendation=f"Rebalance on the {plan.rebalancing_frequency or baseline.rebalancing_frequency} schedule and keep costs low.",
            rationale="Maintenance discipline helps keep the allocation aligned with the stated risk profile.",
            action_items=["Automate contributions", "Avoid market timing"],
            confidence="medium",
        ),
    ]

    if not plan.advisor_cards:
        plan.advisor_cards = fallback_cards
    elif len(plan.advisor_cards) < 6:
        existing_priorities = {card.priority for card in plan.advisor_cards}
        for fallback_card in fallback_cards:
            if len(plan.advisor_cards) >= 6:
                break
            if fallback_card.priority in existing_priorities:
                fallback_card.priority = max(existing_priorities, default=0) + 1
            plan.advisor_cards.append(fallback_card)
            existing_priorities.add(fallback_card.priority)

    if not plan.target_allocation:
        plan.target_allocation = baseline.target_allocation
        plan.monthly_investment_breakdown = baseline.monthly_investment_breakdown

    total = sum(item.percentage for item in plan.target_allocation)
    if total <= 0:
        plan.target_allocation = baseline.target_allocation
        plan.monthly_investment_breakdown = baseline.monthly_investment_breakdown
    elif abs(total - 100) > 1:
        total_monthly = sum(baseline.monthly_investment_breakdown.values())
        for item in plan.target_allocation:
            item.percentage = round((item.percentage / total) * 100, 1)
            item.monthly_amount = round((item.percentage / 100) * total_monthly, 2)

    # Clamp satellite stock ideas so no single idea exceeds the 10% cap and
    # total satellite exposure stays at or below 10% of the plan.
    for idea in plan.satellite_stock_ideas:
        if idea.allocation_percent > 10:
            idea.monthly_amount = round(idea.monthly_amount * (10 / idea.allocation_percent), 2)
            idea.allocation_percent = 10
    total_satellite = sum(idea.allocation_percent for idea in plan.satellite_stock_ideas)
    if total_satellite > 10:
        scale = 10 / total_satellite
        for idea in plan.satellite_stock_ideas:
            idea.allocation_percent = round(idea.allocation_percent * scale, 2)
            idea.monthly_amount = round(idea.monthly_amount * scale, 2)

    warnings = list(plan.warnings or [])
    disclaimer = "This is educational guidance, not personalized financial, tax, or legal advice. Verify details before making financial decisions."
    if not any("educational" in warning.lower() for warning in warnings):
        warnings.append(disclaimer)
    if plan.satellite_stock_ideas and not any("satellite" in warning.lower() for warning in warnings):
        warnings.append("Individual stocks are optional satellite ideas only; keep them small relative to diversified ETFs.")
    plan.warnings = warnings
    return plan


def _has_cashflow_context(request: PersonalizedPlanRequest) -> bool:
    return request.monthly_gross_income is not None or request.monthly_expenses is not None or bool(request.loans)


def _fallback_monthly_action_plan(request: PersonalizedPlanRequest) -> MonthlyActionPlan | None:
    if not _has_cashflow_context(request):
        return None

    available = request.monthly_investment_amount
    emergency_gap = 0.0
    if request.monthly_expenses:
        target = request.monthly_expenses * request.emergency_fund_months_target
        emergency_gap = max(target - request.current_emergency_fund, 0)

    emergency_amount = min(available * 0.2, emergency_gap) if emergency_gap > 0 else 0
    high_interest_loans = [loan for loan in request.loans if loan.interest_rate >= 0.08]
    debt_amount = available * 0.2 if high_interest_loans else 0
    etf_amount = max(available - emergency_amount - debt_amount, 0)

    return MonthlyActionPlan(
        available_monthly_amount=available,
        etf_investing_amount=round(etf_amount, 2),
        debt_extra_payment_amount=round(debt_amount, 2),
        emergency_fund_amount=round(emergency_amount, 2),
        notes=["Rule-based allocation because Gemini was unavailable or disabled."],
    )


def _attach_rule_based_advisor_fields(plan: PersonalizedPlanResult, request: PersonalizedPlanRequest) -> PersonalizedPlanResult:
    plan.plan_source = "rule_based"
    plan.advisor_summary = (
        "StackSmart built a rule-based advisor dashboard from your risk tolerance, goal, loans, income, and emergency fund inputs."
    )

    first_allocation = plan.target_allocation[0] if plan.target_allocation else None
    plan.advisor_cards = [
        AdvisorCard(
            title="Core Investing Plan",
            priority=1,
            category="etf_allocation",
            recommendation=f"Invest ${request.monthly_investment_amount:,.0f}/month into the diversified allocation below.",
            rationale="Your selected goal and risk tolerance drive this portfolio mix.",
            action_items=["Set up recurring monthly investing", "Rebalance on the schedule shown below"],
            monthly_amount=request.monthly_investment_amount,
            confidence="medium",
        ),
        AdvisorCard(
            title="Primary Holding Focus",
            priority=2,
            category="investing",
            recommendation=(f"Use {first_allocation.ticker} as a major building block." if first_allocation else "Use broad diversified ETFs as the core."),
            rationale="Broad low-cost funds should remain the core before any satellite picks.",
            action_items=["Keep individual stocks small compared with core ETFs"],
            confidence="medium",
        ),
        AdvisorCard(
            title="Emergency Fund Check",
            priority=3,
            category="emergency_fund",
            recommendation=("Build or top up your emergency fund before increasing risk." if not request.has_emergency_fund else "Maintain your emergency fund while investing."),
            rationale="Liquidity prevents forced selling when expenses surprise you.",
            action_items=["Target 3–6 months of expenses"],
            confidence="medium",
        ),
        AdvisorCard(
            title="Debt Review",
            priority=4,
            category="debt",
            recommendation=("Prioritize extra payments on high-interest loans before adding satellite risk." if request.loans else "No saved loans were provided, so debt guidance is limited."),
            rationale="High-interest debt can beat expected market returns on a risk-adjusted basis.",
            action_items=["Add or update saved loans for better advice"],
            confidence="medium" if request.loans else "low",
        ),
        AdvisorCard(
            title="Cash Flow Allocation",
            priority=5,
            category="cashflow",
            recommendation=("Use the monthly action plan to split available dollars across ETFs, debt, and emergency savings." if _has_cashflow_context(request) else "Add income, expenses, and loans to unlock a monthly dollar action plan."),
            rationale="Dollar-level guidance is most useful when the plan has enough cashflow context.",
            action_items=["Update income and expense inputs", "Refresh saved loans before regenerating"],
            confidence="medium" if _has_cashflow_context(request) else "low",
        ),
        AdvisorCard(
            title="Assumptions to Verify",
            priority=6,
            category="assumptions",
            recommendation="Review missing data and caveats before making financial decisions.",
            rationale="Rule-based guidance cannot account for taxes, account eligibility, or all personal constraints.",
            action_items=["Confirm tax/account fit", "Use this as educational guidance only"],
            confidence="medium",
        ),
    ]

    plan.monthly_action_plan = _fallback_monthly_action_plan(request)
    plan.satellite_stock_ideas = []
    plan.advisor_assumptions = AdvisorAssumptions(
        confidence="medium",
        data_used=[item for item, present in {
            "risk tolerance": bool(request.risk_tolerance),
            "financial goal": bool(request.financial_goal),
            "monthly investment amount": request.monthly_investment_amount > 0,
            "loans": bool(request.loans),
            "income": request.monthly_gross_income is not None,
            "expenses": request.monthly_expenses is not None,
            "emergency fund": request.current_emergency_fund is not None,
        }.items() if present],
        missing_data=[item for item, missing in {
            "income": request.monthly_gross_income is None,
            "expenses": request.monthly_expenses is None,
            "loans": not request.loans,
            "tax filing status": request.tax_filing_status is None,
        }.items() if missing],
        caveats=["Fallback dashboard is rule-based and less adaptive than Gemini."],
    )
    return plan


def generate_ai_financial_plan(request: PersonalizedPlanRequest) -> PersonalizedPlanResult:
    """Build a deterministic baseline, then ask Gemini to refine it.

    Falls back to the deterministic baseline when AI is disabled or when no
    API key is configured, so the endpoint always returns a usable plan.
    """
    baseline = personalized_planner.generate_personalized_plan(request)

    ai_enabled = os.getenv("ENABLE_GEMINI_FINANCIAL_PLANS", "false").lower() == "true"
    if not ai_enabled:
        baseline = _attach_rule_based_advisor_fields(baseline, request)
        baseline.warnings = list(baseline.warnings or []) + [
            "AI plan generation is disabled; showing StackSmart's rule-based fallback plan."
        ]
        return baseline

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    client = genai.Client(api_key=api_key)
    payload = _request_payload(request, baseline)
    schema = PersonalizedPlanResult.model_json_schema()
    prompt = (
        f"{SYSTEM_INSTRUCTIONS}\n\n"
        "Create a custom advisor dashboard for this user, not just an ETF list. "
        "Return JSON only.\n\n"
        f"OUTPUT_JSON_SCHEMA:\n{json.dumps(schema, separators=(',', ':'))}\n\n"
        f"INPUT_JSON:\n{json.dumps(payload, separators=(',', ':'))}"
    )

    response = client.models.generate_content(
        model=DEFAULT_GEMINI_MODEL,
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            system_instruction=SYSTEM_INSTRUCTIONS,
        ),
    )

    try:
        ai_plan = PersonalizedPlanResult.model_validate_json(response.text)
    except ValidationError:
        raise

    return _sanitize_plan(ai_plan, baseline)
