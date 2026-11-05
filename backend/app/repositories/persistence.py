import base64
import json
import logging
import os
from pathlib import Path

from app.models.domain import Assignment, Farm, Message, Task, Worker
from app.repositories.memory import InMemoryRepository, PinRecord

logger = logging.getLogger(__name__)

_VERSION = 1


def default_state_file() -> Path | None:
    """STATE_FILE이 있으면 그 경로, Azure App Service에서는 재시작 후에도 남는 /home 아래를 쓴다."""
    explicit = os.environ.get("STATE_FILE")
    if explicit:
        return Path(explicit)
    if os.environ.get("WEBSITE_SITE_NAME"):
        return Path("/home/data/ilsonitda-state.json")
    return None


def save_state(repo: InMemoryRepository, path: Path) -> None:
    with repo.lock:
        payload = {
            "version": _VERSION,
            "farms": [m.model_dump(mode="json") for m in repo.farms.values()],
            "workers": [m.model_dump(mode="json") for m in repo.workers.values()],
            "tasks": [m.model_dump(mode="json") for m in repo.tasks.values()],
            "assignments": [m.model_dump(mode="json") for m in repo.assignments.values()],
            "messages": [m.model_dump(mode="json") for m in repo.messages.values()],
            "pins": {
                key: {
                    "salt": base64.b64encode(p.salt).decode(),
                    "digest": base64.b64encode(p.digest).decode(),
                    "failures": p.failures,
                    "locked_until": p.locked_until,
                }
                for key, p in repo.pins.items()
            },
        }
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def load_state(repo: InMemoryRepository, path: Path) -> bool:
    """저장 파일을 읽어 저장소를 채운다. 파일이 없거나 손상되면 False(저장소는 그대로)."""
    if not path.is_file():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("version") != _VERSION:
            return False
        farms = {m["id"]: Farm(**m) for m in data["farms"]}
        workers = {m["id"]: Worker(**m) for m in data["workers"]}
        tasks = {m["id"]: Task(**m) for m in data["tasks"]}
        assignments = {m["id"]: Assignment(**m) for m in data["assignments"]}
        messages = {m["id"]: Message(**m) for m in data["messages"]}
        pins = {
            key: PinRecord(
                salt=base64.b64decode(v["salt"]),
                digest=base64.b64decode(v["digest"]),
                failures=v["failures"],
                locked_until=v["locked_until"],
            )
            for key, v in data["pins"].items()
        }
    except Exception:
        logger.exception("저장된 상태를 읽지 못해 데모 데이터로 시작합니다")
        return False

    with repo.lock:
        repo.reset()
        repo.farms.update(farms)
        repo.workers.update(workers)
        repo.tasks.update(tasks)
        repo.assignments.update(assignments)
        repo.messages.update(messages)
        repo.pins.update(pins)
    return True
