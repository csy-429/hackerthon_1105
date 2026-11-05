import pytest
from fastapi.testclient import TestClient

from app.main import create_app

FARMER = {"X-Pin": "1234"}


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_app(serve_frontend=False))


def _task(client, pin="4321", wage=None, skills=None):
    body = {"farm_id": "farm_demo", "title": "t", "start_at": "2030-01-01T09:00:00",
            "end_at": "2030-01-01T12:00:00", "required_workers": 1,
            "required_skills": skills or [], "pin": pin}
    if wage:
        body["hourly_wage"] = wage
    return client.post("/api/tasks", json=body).json()


def _worker(client, pin="5678", skills=None, wage=None, hours=("08", "18")):
    body = {"display_name": "w", "skills": skills or [], "pin": pin,
            "availability": [{"start": f"2030-01-01T{hours[0]}:00:00",
                              "end": f"2030-01-01T{hours[1]}:00:00"}]}
    if wage:
        body["desired_hourly_wage"] = wage
    return client.post("/api/workers", json=body).json()


def test_pin_must_be_four_digits(client):
    bad = {"farm_id": "farm_demo", "title": "t", "start_at": "2030-01-01T09:00:00",
           "end_at": "2030-01-01T12:00:00", "required_workers": 1, "pin": "12"}
    assert client.post("/api/tasks", json=bad).status_code == 422
    assert client.post("/api/tasks", json={**bad, "pin": None}).status_code == 422
    assert "pin" not in client.post("/api/tasks", json={**bad, "pin": "1234"}).json()


def test_task_actions_need_owner_pin(client):
    t = _task(client)
    url = f"/api/tasks/{t['id']}"
    assert client.patch(url, json={"title": "x"}).status_code == 401
    assert client.patch(url, json={"title": "x"}, headers=FARMER).status_code == 403
    ok = client.patch(url, json={"title": "x"}, headers={"X-Pin": "4321"})
    assert ok.status_code == 200 and ok.json()["title"] == "x"
    assert client.post(f"{url}/cancel", headers=FARMER).status_code == 403
    assert client.post(f"{url}/cancel", headers={"X-Pin": "4321"}).status_code == 200


def test_worker_edit_needs_pin_and_lockout(client):
    w = _worker(client)
    url = f"/api/workers/{w['id']}"
    assert client.patch(url, json={"status": "inactive"}).status_code == 401
    for _ in range(5):
        assert client.patch(url, json={"status": "inactive"}, headers=FARMER).status_code == 403
    # 잠금 후에는 올바른 PIN도 거부된다
    locked = client.patch(url, json={"status": "inactive"}, headers={"X-Pin": "5678"})
    assert locked.status_code == 429


def test_worker_pin_correct_toggles_status(client):
    w = _worker(client)
    r = client.patch(f"/api/workers/{w['id']}", json={"status": "inactive"},
                     headers={"X-Pin": "5678"})
    assert r.status_code == 200 and r.json()["status"] == "inactive"


def test_accept_and_confirm_need_pins(client):
    t = _task(client)
    w = _worker(client)
    req = client.post(f"/api/tasks/{t['id']}/request-confirmation",
                      json={"worker_ids": [w["id"]]}, headers={"X-Pin": "4321"})
    assert req.status_code == 200
    asg = req.json()["assignments"][0]["id"]
    assert client.post(f"/api/assignments/{asg}/accept", headers={"X-Pin": "4321"}).status_code == 403
    assert client.post(f"/api/assignments/{asg}/accept", headers={"X-Pin": "5678"}).status_code == 200
    assert client.post(f"/api/tasks/{t['id']}/confirm", json={"farmer_approved": True},
                       headers={"X-Pin": "5678"}).status_code == 403
    done = client.post(f"/api/tasks/{t['id']}/confirm", json={"farmer_approved": True},
                       headers={"X-Pin": "4321"})
    assert done.json()["status"] == "confirmed"


def test_wage_mismatch_is_warning_not_exclusion(client):
    t = _task(client, wage=10000)
    w = _worker(client, wage=15000)
    cands = client.post(f"/api/tasks/{t['id']}/suggestions").json()["candidates"]
    c = next(c for c in cands if c["candidate_id"] == w["id"])
    assert c["eligible"] and any("시급" in x for x in c["warnings"])
    r = client.post(f"/api/tasks/{t['id']}/request-confirmation",
                    json={"worker_ids": [w["id"]]}, headers={"X-Pin": "4321"})
    assert r.status_code == 200


def test_force_request_for_negotiable_mismatch(client):
    t = _task(client, skills=["수확"])
    w = _worker(client, skills=["포장"])
    url = f"/api/tasks/{t['id']}/request-confirmation"
    h = {"X-Pin": "4321"}
    c = next(c for c in client.post(f"/api/tasks/{t['id']}/suggestions").json()["candidates"]
             if c["candidate_id"] == w["id"])
    assert not c["eligible"] and c["requestable"] and not c["blockers"]
    assert client.post(url, json={"worker_ids": [w["id"]]}, headers=h).status_code == 409
    r = client.post(url, json={"worker_ids": [w["id"]], "force_worker_ids": [w["id"]]},
                    headers=h)
    assert r.status_code == 200
    assert r.json()["assignments"][0]["override_reasons"]
    asg = r.json()["assignments"][0]["id"]
    client.post(f"/api/assignments/{asg}/accept", headers={"X-Pin": "5678"})
    done = client.post(f"/api/tasks/{t['id']}/confirm", json={"farmer_approved": True}, headers=h)
    assert done.status_code == 200


def test_blockers_cannot_be_forced(client):
    t = _task(client)
    w = _worker(client)
    client.patch(f"/api/workers/{w['id']}", json={"status": "inactive"},
                 headers={"X-Pin": "5678"})
    r = client.post(f"/api/tasks/{t['id']}/request-confirmation",
                    json={"worker_ids": [w["id"]], "force_worker_ids": [w["id"]]},
                    headers={"X-Pin": "4321"})
    assert r.status_code == 409 and r.json()["detail"]["details"]["blockers"]


def test_apply_requires_worker_pin_and_force(client):
    t = _task(client, skills=["수확"])
    client.patch(f"/api/tasks/{t['id']}", json={"open_recruitment": True},
                 headers={"X-Pin": "4321"})
    w = _worker(client, skills=["포장"])
    url = f"/api/tasks/{t['id']}/apply"
    assert client.post(url, json={"worker_id": w["id"]}).status_code == 401
    h = {"X-Pin": "5678"}
    assert client.post(url, json={"worker_id": w["id"]}, headers=h).status_code == 409
    r = client.post(url, json={"worker_id": w["id"], "force": True}, headers=h)
    assert r.status_code == 201 and r.json()["override_reasons"]


def test_chat_between_parties(client):
    t = _task(client)
    w = _worker(client)
    asg = client.post(f"/api/tasks/{t['id']}/request-confirmation",
                      json={"worker_ids": [w["id"]]},
                      headers={"X-Pin": "4321"}).json()["assignments"][0]["id"]
    url = f"/api/assignments/{asg}/messages"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=FARMER).status_code == 403
    assert client.post(url, json={"text": "시급 협의 가능할까요?"},
                       headers={"X-Pin": "4321"}).json()["sender"] == "farmer"
    assert client.post(url, json={"text": "네 좋아요"},
                       headers={"X-Pin": "5678"}).json()["sender"] == "worker"
    msgs = client.get(url, headers={"X-Pin": "5678"}).json()
    assert [m["sender"] for m in msgs] == ["farmer", "worker"]
    assert client.post(url, json={"text": "010-1234-5678"},
                       headers={"X-Pin": "5678"}).status_code == 422
    client.post(f"/api/assignments/{asg}/decline", headers={"X-Pin": "5678"})
    assert client.post(url, json={"text": "hi"}, headers={"X-Pin": "5678"}).status_code == 409


def _asg(client, t, w):
    return client.post(f"/api/tasks/{t['id']}/request-confirmation",
                       json={"worker_ids": [w["id"]]},
                       headers={"X-Pin": "4321"}).json()["assignments"][0]["id"]


def test_wage_offer_and_agreement(client):
    t = _task(client, wage=11000)
    w = _worker(client)
    asg = _asg(client, t, w)
    farmer, worker = {"X-Pin": "4321"}, {"X-Pin": "5678"}
    base = f"/api/assignments/{asg}"
    assert client.post(f"{base}/wage-offer", json={"wage": 12000}).status_code == 401
    assert client.post(f"{base}/wage-offer/accept", headers=worker).status_code == 409
    assert client.post(f"{base}/wage-offer", json={"wage": 0}, headers=worker).status_code == 422
    offered = client.post(f"{base}/wage-offer", json={"wage": 12500}, headers=worker).json()
    assert offered["offer_wage"] == 12500 and offered["offer_by"] == "worker"
    assert offered["agreed_wage"] is None
    # 제안자 본인은 수락할 수 없다
    assert client.post(f"{base}/wage-offer/accept", headers=worker).status_code == 409
    # 새 제안은 이전 제안을 대체한다
    counter = client.post(f"{base}/wage-offer", json={"wage": 12000}, headers=farmer).json()
    assert counter["offer_wage"] == 12000 and counter["offer_by"] == "farmer"
    agreed = client.post(f"{base}/wage-offer/accept", headers=worker).json()
    assert agreed["agreed_wage"] == 12000 and agreed["offer_wage"] is None
    kinds = [m["kind"] for m in client.get(f"{base}/messages", headers=worker).json()]
    assert kinds == ["wage_offer", "wage_offer", "wage_accept"]
    assert client.post(f"{base}/wage-offer/accept", headers=farmer).status_code == 409


def test_assignment_exposes_message_metadata_without_content(client):
    t = _task(client)
    w = _worker(client)
    asg = _asg(client, t, w)
    view = client.get(f"/api/tasks/{t['id']}").json()["assignments"][0]
    assert view["message_count"] == 0 and view["last_message_sender"] is None
    client.post(f"/api/assignments/{asg}/messages", json={"text": "hi"},
                headers={"X-Pin": "4321"})
    view = client.get(f"/api/assignments?task_id={t['id']}").json()[0]
    assert view["message_count"] == 1 and view["last_message_sender"] == "farmer"
    assert "text" not in view
