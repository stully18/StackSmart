"""Integration tests for the Stock of the Day FastAPI endpoints.

verify_user_token is overridden (no real Supabase auth call), and the query
service functions are monkeypatched directly rather than hitting Supabase.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.middleware.auth import verify_user_token
from app.services import stock_of_the_day_query_service as query_service

app.dependency_overrides[verify_user_token] = lambda: "test-user-id"

client = TestClient(app)


class TestGetStockOfTheDay:
    def test_returns_latest_pick(self, monkeypatch):
        pick = {"ticker": "AAPL", "pick_date": "2026-07-10", "composite_score": 0.82, "factor_breakdown": {}}
        monkeypatch.setattr(query_service, "get_latest_pick", lambda: pick)

        response = client.get("/api/stock-of-the-day")

        assert response.status_code == 200
        assert response.json() == pick

    def test_returns_404_when_no_pick(self, monkeypatch):
        monkeypatch.setattr(query_service, "get_latest_pick", lambda: None)

        response = client.get("/api/stock-of-the-day")

        assert response.status_code == 404


class TestGetStockOfTheDayHistory:
    def test_returns_picks(self, monkeypatch):
        picks = [{"ticker": "AAPL", "pick_date": "2026-07-10"}]
        monkeypatch.setattr(query_service, "get_pick_history", lambda days: picks)

        response = client.get("/api/stock-of-the-day/history?days=10")

        assert response.status_code == 200
        assert response.json() == {"picks": picks}

    def test_rejects_out_of_range_days(self):
        response = client.get("/api/stock-of-the-day/history?days=1000")

        assert response.status_code == 400


class TestGetStockOfTheDayPerformance:
    def test_returns_records_and_summary(self, monkeypatch):
        records = [{"ticker": "AAPL", "return_1d": 0.01, "spy_return_1d": 0.005}]
        monkeypatch.setattr(query_service, "get_performance_history", lambda days: records)

        response = client.get("/api/stock-of-the-day/performance?days=30")

        assert response.status_code == 200
        body = response.json()
        assert body["performance"] == records
        assert body["summary"]["1d"]["sample_size"] == 1

    def test_rejects_out_of_range_days(self):
        response = client.get("/api/stock-of-the-day/performance?days=0")

        assert response.status_code == 400
