from decimal import Decimal, getcontext

import pytest

from app.services.investment_projections import build_projection, future_value, months_to_goal, parse_goal


@pytest.mark.parametrize("rate", [-.06, 0, 1e-10, .03, .06])
@pytest.mark.parametrize("months", [0, 1, 12, 60, 600])
def test_compounding_matches_independent_decimal_month_by_month_recurrence(rate, months):
    getcontext().prec = 45
    balance = Decimal(0)
    monthly_rate = Decimal(str(rate)) / 12
    deposit = Decimal('123.45')
    for _ in range(months):
        balance = balance * (1 + monthly_rate) + deposit
    assert future_value(123.45, rate, months) == pytest.approx(float(balance), rel=1e-12, abs=1e-8)


def test_end_of_month_deposits_and_zero_rate():
    assert future_value(500, .12, 0) == 0
    assert future_value(500, .12, 1) == 500
    assert future_value(500, 0, 60) == 30000
    assert future_value(100, .12, 12) == pytest.approx(1268.2503013197)


@pytest.mark.parametrize("text,amount,months", [
    ('$30,000 for a house down payment in 5 years', 30000, 60),
    ('A car for $20k within 24 months', 20000, 24),
    ('USD 50000 in two years', 50000, 24),
    ('$1.2 million in 30 years', 1200000, 360),
    ('$5,000 in 1.5 years', 5000, 18),
    ('$1,000 needed now', 1000, 0),
])
def test_extracts_only_explicit_goal_numbers(text, amount, months):
    goal = parse_goal(text)
    assert goal.amount == amount and goal.months == months
    assert goal.near_term is (months <= 36)


@pytest.mark.parametrize("text", [None, '', 'a house', 'retirement at age 65'])
def test_missing_targets_are_not_invented(text):
    goal = parse_goal(text)
    assert goal.amount is None and goal.months is None


def test_ambiguous_goal_and_invalid_currency_are_not_guessed():
    goal = parse_goal('$20k in 2 years or $50k in 5 years')
    assert goal.amount is None and goal.months is None and goal.near_term
    assert goal.note
    assert parse_goal('-$1000 in 5 years').amount is None
    assert parse_goal('$1e309 in 5 years').amount is None
    assert parse_goal('$40,00 in 5 years').amount is None
    assert parse_goal('$500 per month for a house').amount is None
    assert parse_goal('$500 per month toward $30k in 5 years').amount == 30000
    assert parse_goal('An emergency fund').near_term
    assert parse_goal('$10k in half a year').months is None
    ranged = parse_goal('$30k in 2 to 5 years')
    assert ranged.months is None and ranged.near_term


def test_goal_timing_uses_first_sufficient_month():
    assert months_to_goal(100, 0, 1000) == 10
    assert months_to_goal(500, .12, 1005) == 2
    result = months_to_goal(500, .06, 30000)
    assert future_value(500, .06, result) >= 30000
    assert future_value(500, .06, result - 1) < 30000
    assert months_to_goal(1, 0, 1000000) is None


def test_contributions_growth_and_required_payment_reconcile():
    result = build_projection(500, .06, '$40,000 in 5 years')
    point = result['goal_point']
    assert point['months'] == 60 and point['contributions'] == 30000
    assert point['balance'] == round(future_value(500, .06, 60), 2)
    assert point['balance'] == pytest.approx(point['contributions'] + point['growth'], abs=.01)
    assert result['shortfall'] == round(40000 - point['balance'], 2)
    required = result['required_monthly_amount']
    assert future_value(required, .06, 60) >= 40000
    assert future_value(required - .01, .06, 60) < 40000


def test_zero_rate_required_payment_and_immediate_goal():
    result = build_projection(100, 0, '$1,200 in 12 months')
    assert result['required_monthly_amount'] == 100
    assert result['shortfall'] == 0
    assert build_projection(500, .12, '$1,005 in 2 months')['required_monthly_amount'] == 500
    immediate = build_projection(100, .03, '$1,000 needed now')
    assert immediate['goal_point']['balance'] == 0 and immediate['required_monthly_amount'] is None


@pytest.mark.parametrize("args", [(float('inf'), .03, 12), (100, float('nan'), 12), (100, .03, -1), (100, .03, 601), (-1, .03, 12)])
def test_invalid_projection_values_rejected(args):
    with pytest.raises(ValueError):
        future_value(*args)
