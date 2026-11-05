from fastapi.testclient import TestClient

from app.agent.planner import UnconfiguredPlanner
from app.main import create_app


def _client(path):
    app = create_app(planner=UnconfiguredPlanner(), serve_frontend=False, state_file=path)
    return TestClient(app, headers={"X-Pin": "1234"})


def test_state_survives_restart(tmp_path) -> None:
    path = tmp_path / "state.json"
    first = _client(path)
    task = first.get("/api/demo").json()["tasks"][0]
    res = first.post(f"/api/tasks/{task['id']}/cancel")
    assert res.status_code == 200, res.text
    assert path.is_file()

    second = _client(path)
    tasks = {t["id"]: t for t in second.get("/api/demo").json()["tasks"]}
    assert tasks[task["id"]]["status"] == "cancelled"


def test_corrupt_state_falls_back_to_demo(tmp_path) -> None:
    path = tmp_path / "state.json"
    path.write_text("{not json", encoding="utf-8")
    client = _client(path)
    assert client.get("/api/demo").json()["tasks"]
