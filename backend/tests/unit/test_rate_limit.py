from fastapi.testclient import TestClient

from app.agent.planner import UnconfiguredPlanner
from app.api.ratelimit import SlidingWindowLimiter
from app.main import create_app


def test_limiter_blocks_after_limit_and_per_key() -> None:
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
    assert limiter.check("a") is None
    assert limiter.check("a") is None
    assert limiter.check("a") is not None
    assert limiter.check("b") is None


def test_plan_endpoint_returns_429_when_limit_exceeded() -> None:
    app = create_app(planner=UnconfiguredPlanner(), serve_frontend=False)
    app.state.agent_limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
    client = TestClient(app, headers={"X-Pin": "1234"})
    codes = [client.post("/api/agent/plan", json={"task_id": "task_harvest"}).status_code for _ in range(3)]
    assert codes == [503, 503, 429]
