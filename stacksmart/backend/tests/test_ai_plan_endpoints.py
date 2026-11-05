import threading
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app import main
from app.middleware.auth import verify_user_token
from app.services.ai_financial_planner import AIPlanError
from tests.test_ai_financial_planner import _sample_plan


@pytest.fixture
def planning_client(monkeypatch):
    previous = dict(main.app.dependency_overrides)
    main.app.dependency_overrides[verify_user_token] = lambda: "synthetic-user"
    reserve = AsyncMock(return_value="synthetic-generation")
    complete = AsyncMock()
    release = AsyncMock()
    monkeypatch.setattr(main, "reserve_daily_generation", reserve)
    monkeypatch.setattr(main, "complete_daily_generation", complete)
    monkeypatch.setattr(main, "release_failed_generation", release)
    with TestClient(main.app) as client:
        yield client, reserve, complete, release
    main.app.dependency_overrides.clear()
    main.app.dependency_overrides.update(previous)


def test_timeout_returns_cors_json_and_releases_quota(planning_client, monkeypatch):
    client, reserve, complete, release = planning_client
    def generate(request):
        raise AIPlanError("The AI provider took too long to respond. Please try again shortly.", 504)
    monkeypatch.setattr(main.ai_financial_planner, "generate_ai_financial_plan", generate)
    response = client.post("/api/plan/generate", json={"monthly_investment_amount": 300}, headers={"Origin": "https://stacksmart.dev"})
    assert response.status_code == 504
    assert "took too long" in response.json()["detail"]
    assert response.headers["access-control-allow-origin"] == "https://stacksmart.dev"
    reserve.assert_awaited_once()
    complete.assert_not_awaited()
    release.assert_awaited_once()


def test_generation_runs_off_event_loop_and_persists_once(planning_client, monkeypatch):
    client, reserve, complete, release = planning_client
    threads = {}
    async def reserve_generation(**kwargs):
        threads["event_loop"] = threading.get_ident()
        return "synthetic-generation"
    reserve.side_effect = reserve_generation
    def generate(request):
        threads["generation"] = threading.get_ident()
        return _sample_plan()
    monkeypatch.setattr(main.ai_financial_planner, "generate_ai_financial_plan", generate)
    response = client.post("/api/plan/generate", json={"monthly_investment_amount": 300})
    assert response.status_code == 200
    assert threads["generation"] != threads["event_loop"]
    complete.assert_awaited_once()
    release.assert_not_awaited()
