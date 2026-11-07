"""Deterministic goal parsing and end-of-month compound-growth illustrations.

No model output supplies targets, dates, return assumptions, or calculated values.
"""
from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING, localcontext
import math
import re

MAX_MONTHS = 600
SAVINGS_ANNUAL_RATE = 0.03  # Illustrative nominal rate, NOT a current bank APY.


@dataclass(frozen=True)
class GoalContext:
    amount: float | None = None
    months: int | None = None
    near_term: bool = False
    note: str | None = None


def parse_goal(text: str | None) -> GoalContext:
    if not text or not text.strip():
        return GoalContext()
    money = list(re.finditer(r"(?<![\w.,])(?:(?:\$|usd\s*)(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(thousand|million|grand|k|m)?|(\d+(?:\.\d{1,2})?)\s*(grand|thousand|million|k|m))(?![\w.,])", text, re.I))
    # A repeated monthly contribution is not the purchase/savings target.
    money = [match for match in money if not re.match(r"\s*(?:/\s*(?:mo(?:nth)?|yr|year)\b|(?:per|a)\s+(?:month|year)\b|monthly\b)", text[match.end():], re.I)]
    amounts = []
    for match in money:
        if text[:match.start()].rstrip().endswith('-'):
            continue
        scale = {"k": 1000, "thousand": 1000, "grand": 1000, "m": 1000000, "million": 1000000}.get((match[2] or match[4] or '').lower(), 1)
        value = float((match[1] or match[3]).replace(',', '')) * scale
        if .01 <= value <= 1e12:
            amounts.append(value)
    periods = list(re.finditer(r"(?<![\w.-])(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|a)\s*(years?|yrs?|months?|mos?)\b", text, re.I))
    words = {"a": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
    durations = []
    for match in periods:
        if text[:match.start()].rstrip().endswith('-'):
            continue
        # Do not read just "a year" out of an unsupported fractional phrase.
        if match[1].lower() == 'a' and re.search(r"\b(half|of)\s*$", text[:match.start()], re.I):
            continue
        raw = match[1].lower()
        number = words[raw] if raw in words else float(raw)
        value = number * (12 if match[2].lower().startswith(('y',)) else 1)
        if 0 <= value <= MAX_MONTHS and float(value).is_integer():
            durations.append(int(value))
    amount = amounts[0] if len(money) == len(amounts) == 1 else None
    months = durations[0] if len(periods) == len(durations) == 1 else None
    ranges = list(re.finditer(r"\b(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(years?|yrs?|months?|mos?)\b", text, re.I))
    range_near_term = False
    if ranges:
        months = None  # A range is not one explicit deadline.
        range_near_term = any(min(float(match[1]), float(match[2])) * (12 if match[3].lower().startswith('y') else 1) <= 36 for match in ranges)
    if re.search(r"\b(now|immediately)\b", text, re.I) and not periods:
        months = 0
        durations = [0]
    notes = []
    if amount is None:
        notes.append('For a target comparison, include one dollar amount, such as $30,000.')
    if months is None:
        notes.append('For a deadline comparison, include one timeframe, such as in 5 years or in 24 months.')
    accessible = bool(re.search(r"\b(soon|short[- ]term|next year|next month|emergency|rainy[- ]day|half a year|quarter of a year|a few months)\b", text, re.I))
    return GoalContext(amount, months, any(n <= 36 for n in durations) or range_near_term or accessible, ' '.join(notes) or None)


def future_value(monthly: float, annual_rate: float, months: int) -> float:
    """Ordinary annuity: P * expm1(n * log1p(r/12)) / (r/12)."""
    if (not math.isfinite(monthly) or monthly < 0 or not math.isfinite(annual_rate)
            or not -1 < annual_rate <= 1 or not isinstance(months, int) or not 0 <= months <= MAX_MONTHS):
        raise ValueError('Invalid projection inputs')
    if months <= 1:
        return monthly * months
    rate = annual_rate / 12
    factor = months if rate == 0 else math.expm1(months * math.log1p(rate)) / rate
    return monthly * factor


def months_to_goal(monthly: float, annual_rate: float, target: float) -> int | None:
    if target <= 0:
        return 0
    if round(future_value(monthly, annual_rate, MAX_MONTHS), 2) < target:
        return None
    low, high = 1, MAX_MONTHS
    while low < high:
        middle = (low + high) // 2
        if round(future_value(monthly, annual_rate, middle), 2) >= target:
            high = middle
        else:
            low = middle + 1
    return low


def build_projection(monthly: float, annual_rate: float, goal: str | None) -> dict:
    # Use exactly the nominal rate displayed to the user (four percentage decimals).
    annual_rate = round(annual_rate, 6)
    context = parse_goal(goal)
    def point(months):
        balance = future_value(monthly, annual_rate, months)
        deposited = monthly * months
        return {"months": months, "balance": round(balance, 2), "contributions": round(deposited, 2),
                "growth": round(balance - deposited, 2)}
    required = None
    if context.amount is not None and context.months is not None and context.months > 0:
        # Decimal recurrence avoids an extra cent at exact payment boundaries.
        with localcontext() as ctx:
            ctx.prec = 45
            factor = Decimal(0)
            growth = 1 + Decimal(str(annual_rate)) / 12
            for _ in range(context.months):
                factor = factor * growth + 1
            required = float((Decimal(str(context.amount)) / factor).quantize(Decimal('.01'), rounding=ROUND_CEILING))
    goal_point = point(context.months) if context.months is not None else None
    gap = None if context.amount is None or goal_point is None else round(max(context.amount - goal_point['balance'], 0), 2)
    return {"annual_rate_percent": round(annual_rate * 100, 4), "monthly_amount": monthly,
            "milestones": [point(n) for n in (12, 36, 60)], "goal_amount": context.amount,
            "goal_months": context.months, "goal_point": goal_point, "shortfall": gap,
            "required_monthly_amount": required,
            "months_to_goal": months_to_goal(monthly, annual_rate, context.amount) if context.amount is not None else None,
            "parsing_note": context.note, "maximum_months": MAX_MONTHS,
            "assumptions": 'Starts at $0, with deposits at the end of each month and a constant nominal annual rate compounded monthly. Before fees, taxes, and inflation. Returns and savings rates can change; investment losses are possible. This is an illustration, not a guarantee or a current bank APY. Goal comparisons do not include financing, purchase costs, or future home/car prices.'}
