import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_app(serve_frontend=False), headers={"X-Pin": "1234"})


def _ids(candidates, eligible):
    return [c["candidate_id"] for c in candidates if c["eligible"] == eligible]


def test_demo_loaded(client):
    data = client.get("/api/demo").json()
    assert len(data["workers"]) == 7
    assert any(t["status"] == "confirmed" for t in data["tasks"])


def test_task_crud_and_cancel(client):
    body = {
        "farm_id": "farm_demo",
        "title": "포장",
        "start_at": "2030-01-01T09:00:00",
        "end_at": "2030-01-01T12:00:00",
        "required_workers": 1,
        "required_skills": ["포장"], "pin": "1234",
    }
    created = client.post("/api/tasks", json=body)
    assert created.status_code == 201
    tid = created.json()["id"]
    assert created.json()["status"] == "draft"
    patched = client.patch(f"/api/tasks/{tid}", json={"title": "포장2"})
    assert patched.json()["title"] == "포장2"
    assert client.post(f"/api/tasks/{tid}/cancel").json()["status"] == "cancelled"
    assert client.patch(f"/api/tasks/{tid}", json={"title": "x"}).status_code == 409


def test_bad_input_and_status_injection(client):
    bad = {"farm_id": "farm_demo", "title": "x", "start_at": "2030-01-01T12:00:00",
           "end_at": "2030-01-01T09:00:00", "required_workers": 1, "required_skills": [], "pin": "1234"}
    assert client.post("/api/tasks", json=bad).status_code == 422
    ok = {**bad, "end_at": "2030-01-01T13:00:00", "status": "confirmed"}
    assert client.post("/api/tasks", json=ok).status_code == 422


def test_unknown_task_404(client):
    assert client.get("/api/tasks/nope").status_code == 404


def test_full_flow_requires_acceptance(client):
    sug = client.post("/api/tasks/task_sorting/suggestions").json()
    eligible = _ids(sug["candidates"], True)
    excluded = {c["candidate_id"]: c for c in sug["candidates"] if not c["eligible"]}
    assert "worker_gaon" in excluded and excluded["worker_gaon"]["exclusions"]
    assert "worker_narae" in eligible

    r = client.post("/api/tasks/task_sorting/request-confirmation",
                    json={"worker_ids": ["worker_narae"]})
    assert r.status_code == 200 and r.json()["status"] == "proposed"
    # 인원 부족 / 미수락 상태에서는 확정 불가
    assert client.post("/api/tasks/task_sorting/confirm",
                       json={"farmer_approved": True}).status_code == 409
    assert client.post("/api/tasks/task_sorting/confirm",
                       json={"farmer_approved": False}).status_code == 400


def test_ineligible_worker_rejected(client):
    r = client.post("/api/tasks/task_sorting/request-confirmation",
                    json={"worker_ids": ["worker_bora"]})
    assert r.status_code == 409


def test_confirm_after_accept(client):
    client.post("/api/tasks", json={
        "farm_id": "farm_demo", "title": "단일", "start_at": "2030-01-01T09:00:00",
        "end_at": "2030-01-01T10:00:00", "required_workers": 1, "required_skills": [], "pin": "1234"})
    task = [t for t in client.get("/api/tasks").json() if t["title"] == "단일"][0]
    w = client.post("/api/workers", json={
        "display_name": "신규", "skills": ["수확"], "pin": "1234",
        "availability": [{"start": "2030-01-01T08:00:00", "end": "2030-01-01T18:00:00"}]}).json()
    t = client.post(f"/api/tasks/{task['id']}/request-confirmation",
                    json={"worker_ids": [w["id"]]}).json()
    asg = t["assignments"][0]["id"]
    assert t["status"] == "proposed"
    assert client.post(f"/api/tasks/{task['id']}/confirm",
                       json={"farmer_approved": True}).status_code == 409
    client.post(f"/api/assignments/{asg}/accept")
    done = client.post(f"/api/tasks/{task['id']}/confirm", json={"farmer_approved": True})
    assert done.json()["status"] == "confirmed"


def test_worker_sees_own_assignments_and_edits_schedule(client):
    client.post("/api/tasks/task_sorting/request-confirmation",
                json={"worker_ids": ["worker_narae"]})
    mine = client.get("/api/assignments", params={"worker_id": "worker_narae"}).json()
    assert len(mine) == 1 and mine[0]["task_id"] == "task_sorting"
    assert client.get("/api/assignments", params={"worker_id": "worker_raon"}).json() == []
    r = client.patch("/api/workers/worker_raon", json={
        "availability": [{"start": "2030-01-01T08:00:00", "end": "2030-01-01T18:00:00"}]})
    assert r.status_code == 200 and len(r.json()["availability"]) == 1


def _public_worker(client, **extra):
    body = {"display_name": "낯선이", "skills": ["운반"], "experience": "", "intro": "", "pin": "1234",
            "availability": [{"start": "2030-01-01T08:00:00", "end": "2030-01-01T18:00:00"}]}
    body.update(extra)
    return client.post("/api/workers", params={"public": "true"}, json=body)


def _open_task(client, required=1, open_recruitment=True):
    return client.post("/api/tasks", json={
        "farm_id": "farm_demo", "title": "공개", "start_at": "2030-01-01T09:00:00",
        "end_at": "2030-01-01T12:00:00", "required_workers": required,
        "required_skills": ["운반"], "open_recruitment": open_recruitment, "pin": "1234"}).json()


def test_public_applicant_flow(client):
    task = _open_task(client)
    w = _public_worker(client).json()
    assert w["origin"] == "public"
    opps = client.get(f"/api/workers/{w['id']}/opportunities").json()
    assert any(o["task"]["id"] == task["id"] and o["evaluation"]["eligible"] for o in opps)

    cands = client.post(f"/api/tasks/{task['id']}/suggestions").json()["candidates"]
    assert w["id"] not in [c["candidate_id"] for c in cands]

    r = client.post(f"/api/tasks/{task['id']}/apply", json={"worker_id": w["id"]})
    assert r.status_code == 201 and r.json()["status"] == "applied"
    assert client.post(f"/api/tasks/{task['id']}/apply",
                       json={"worker_id": w["id"]}).status_code == 409
    cands = client.post(f"/api/tasks/{task['id']}/suggestions").json()["candidates"]
    assert w["id"] in [c["candidate_id"] for c in cands]
    assert client.get(f"/api/tasks/{task['id']}").json()["active_count"] == 0

    t = client.post(f"/api/tasks/{task['id']}/request-confirmation",
                    json={"worker_ids": [w["id"]]}).json()
    assert t["assignments"][0]["status"] == "accepted"
    done = client.post(f"/api/tasks/{task['id']}/confirm", json={"farmer_approved": True})
    assert done.json()["status"] == "confirmed"


def test_apply_rules(client):
    closed = _open_task(client, open_recruitment=False)
    w = _public_worker(client).json()
    assert client.post(f"/api/tasks/{closed['id']}/apply",
                       json={"worker_id": w["id"]}).status_code == 409
    task = _open_task(client)
    bad = _public_worker(client, skills=["방제"]).json()
    r = client.post(f"/api/tasks/{task['id']}/apply", json={"worker_id": bad["id"]})
    assert r.status_code == 409 and r.json()["detail"]["details"]["exclusions"]


def test_public_worker_cannot_be_picked_without_applying(client):
    task = _open_task(client)
    w = _public_worker(client).json()
    r = client.post(f"/api/tasks/{task['id']}/request-confirmation",
                    json={"worker_ids": [w["id"]]})
    assert r.status_code == 409


def test_withdraw_application_and_pii_rejected(client):
    task = _open_task(client)
    w = _public_worker(client).json()
    asg = client.post(f"/api/tasks/{task['id']}/apply", json={"worker_id": w["id"]}).json()
    r = client.post(f"/api/assignments/{asg['id']}/decline")
    assert r.status_code == 200 and r.json()["status"] == "declined"
    assert _public_worker(client, intro="연락처 010-1234-5678").status_code == 422
    assert _public_worker(client, experience="a@b.com").status_code == 422


def test_agent_unavailable_is_not_faked(client):
    r = client.post("/api/agent/plan", json={"task_id": "task_sorting", "request": "설명"})
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "agent_unavailable"
