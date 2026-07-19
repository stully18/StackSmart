from __future__ import annotations

import json
import os
from typing import Any

from google import genai
from pydantic import ValidationError

from app.models.schemas import PersonalizedPlanRequest, PersonalizedPlanResult
from app.services import personalized_planner

# Model is env-configurable; default documents the current Flash model at
# implementation time. The exact default can be bumped via GEMINI_MODEL.
DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

SYSTEM_INSTRUCTIONS = """
You are StackSmart's financial planning assistant. Produce educational, general financial planning guidance, not professional financial, tax, or legal advice.
Use the deterministic baseline as a guardrail. Do not recommend individual stocks, crypto, leverage, options, or market timing.
Prioritize: emergency fund, high-interest debt, employer match, tax-advantaged accounts, diversified low-cost ETFs.
Return only JSON matching the provided schema.
""".strip()


def _request_payload(request: PersonalizedPlanRequest, baseline: PersonalizedPlanResult) -> dict[str, Any]:
    return {
        "user_inputs": request.model_dump(mode="json"),
        "deterministic_baseline": baseline.model_dump(mode="json"),
        "requirements": [
            "Keep target_allocation percentages positive and totaling approximately 100.",
            "Keep all projection numbers realistic and internally consistent.",
            "Include warnings for no emergency fund, high-interest loans, low savings, or short time horizons.",
            "Mention that this is educational guidance and the user should verify before acting.",
        ],
    }


def _sanitize_plan(plan: PersonalizedPlanResult, baseline: PersonalizedPlanResult) -> PersonalizedPlanResult:
    """Clamp obvious model mistakes while keeping Gemini's useful wording."""
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

    warnings = list(plan.warnings or [])
    disclaimer = "This is educational guidance, not personalized financial, tax, or legal advice. Verify details before making financial decisions."
    if not any("educational" in warning.lower() for warning in warnings):
        warnings.append(disclaimer)
    plan.warnings = warnings
    return plan


def generate_ai_financial_plan(request: PersonalizedPlanRequest) -> PersonalizedPlanResult:
    """Build a deterministic baseline, then ask Gemini to refine it.

    Falls back to the deterministic baseline when AI is disabled or when no
    API key is configured, so the endpoint always returns a usable plan.
    """
    baseline = personalized_planner.generate_personalized_plan(request)

    ai_enabled = os.getenv("ENABLE_GEMINI_FINANCIAL_PLANS", "false").lower() == "true"
    if not ai_enabled:
        baseline.warnings = list(baseline.warnings or []) + [
            "AI plan generation is disabled; showing StackSmart's rule-based plan."
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
        "Create a custom financial plan for this user. Return JSON only.\n\n"
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
