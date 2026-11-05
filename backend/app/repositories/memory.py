import threading
from dataclasses import dataclass
from uuid import uuid4

from app.errors import NotFoundError
from app.models.domain import Assignment, Farm, Message, Task, Worker


@dataclass
class PinRecord:
    salt: bytes
    digest: bytes
    failures: int = 0
    locked_until: float = 0.0


class InMemoryRepository:
    """데모용 저장소. 프로세스 재시작 시 데이터가 초기화된다."""

    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.farms: dict[str, Farm] = {}
        self.workers: dict[str, Worker] = {}
        self.tasks: dict[str, Task] = {}
        self.assignments: dict[str, Assignment] = {}
        self.messages: dict[str, Message] = {}
        # 비밀번호 해시는 응답 모델과 섞이지 않도록 도메인 객체 밖에 둔다.
        self.pins: dict[str, PinRecord] = {}

    def reset(self) -> None:
        with self.lock:
            self.farms.clear()
            self.workers.clear()
            self.tasks.clear()
            self.assignments.clear()
            self.messages.clear()
            self.pins.clear()

    @staticmethod
    def new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:8]}"

    def get_farm(self, farm_id: str) -> Farm:
        farm = self.farms.get(farm_id)
        if farm is None:
            raise NotFoundError("농장을 찾을 수 없습니다")
        return farm

    def get_worker(self, worker_id: str) -> Worker:
        worker = self.workers.get(worker_id)
        if worker is None:
            raise NotFoundError("일손을 찾을 수 없습니다")
        return worker

    def get_task(self, task_id: str) -> Task:
        task = self.tasks.get(task_id)
        if task is None:
            raise NotFoundError("작업을 찾을 수 없습니다")
        return task

    def get_assignment(self, assignment_id: str) -> Assignment:
        assignment = self.assignments.get(assignment_id)
        if assignment is None:
            raise NotFoundError("배치를 찾을 수 없습니다")
        return assignment

    def assignments_for_task(self, task_id: str) -> list[Assignment]:
        return sorted(
            (a for a in self.assignments.values() if a.task_id == task_id),
            key=lambda a: a.created_at,
        )
