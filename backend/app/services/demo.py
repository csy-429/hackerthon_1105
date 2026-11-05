from datetime import date, datetime, time, timedelta

from app.models.domain import (
    Assignment,
    AssignmentStatus,
    Farm,
    Task,
    TaskStatus,
    TimeWindow,
    Worker,
    WorkerStatus,
)
from app.repositories.memory import InMemoryRepository
from app.schemas.responses import DemoPayload
from app.services.tasks import list_task_views

DEMO_NOTICE = (
    "가상의 농장·일손·일정 데이터입니다. 실제 개인정보를 입력하지 마세요. "
    "데이터는 서버 메모리에만 저장되며 서버가 재시작되거나 초기화하면 사라집니다."
)
DEMO_FARM_ID = "farm_demo"


def _at(day: date, hour: int) -> datetime:
    return datetime.combine(day, time(hour=hour))


def _window(day: date, start: int, end: int) -> TimeWindow:
    return TimeWindow(start=_at(day, start), end=_at(day, end))


def load_demo(repo: InMemoryRepository, today: date | None = None) -> None:
    base = (today or date.today()) + timedelta(days=1)
    day1, day2, day3 = base, base + timedelta(days=1), base + timedelta(days=2)
    now = datetime.combine(base, time(hour=0))

    with repo.lock:
        repo.reset()
        repo.farms[DEMO_FARM_ID] = Farm(
            id=DEMO_FARM_ID, name="햇살 복숭아 농원(데모)", region_label="데모 지역", created_at=now
        )

        workers = [
            Worker(
                id="worker_gaon",
                display_name="일손 가온",
                skills=["수확", "선별", "운반"],
                availability=[_window(day1, 8, 18), _window(day2, 8, 18)],
            ),
            Worker(
                id="worker_narae",
                display_name="일손 나래",
                skills=["수확", "포장", "선별"],
                availability=[_window(day1, 8, 17), _window(day2, 8, 17)],
            ),
            Worker(
                id="worker_dasom",
                display_name="일손 다솜",
                skills=["방제"],
                availability=[_window(day1, 7, 16), _window(day2, 7, 16), _window(day3, 7, 16)],
            ),
            Worker(
                id="worker_raon",
                display_name="일손 라온",
                skills=["수확", "선별", "포장", "운반"],
                availability=[_window(day1, 8, 12)],
            ),
            Worker(
                id="worker_maru",
                display_name="일손 마루",
                skills=["수확", "운반", "선별"],
                availability=[_window(day1, 8, 18), _window(day2, 8, 18)],
            ),
            Worker(
                id="worker_bora",
                display_name="일손 보라",
                skills=["수확", "선별"],
                availability=[_window(day1, 8, 18)],
                status=WorkerStatus.INACTIVE,
            ),
        ]
        for worker in workers:
            repo.workers[worker.id] = worker

        tasks = [
            Task(
                id="task_harvest",
                farm_id=DEMO_FARM_ID,
                title="복숭아 수확 (1일차 오전)",
                description="동쪽 과수원 수확",
                start_at=_at(day1, 8),
                end_at=_at(day1, 12),
                required_workers=2,
                required_skills=["수확"],
                status=TaskStatus.CONFIRMED,
            ),
            Task(
                id="task_sorting",
                farm_id=DEMO_FARM_ID,
                title="복숭아 선별 (1일차)",
                description="수확 후 선별 작업",
                start_at=_at(day1, 9),
                end_at=_at(day1, 15),
                required_workers=2,
                required_skills=["선별"],
            ),
            Task(
                id="task_spray",
                farm_id=DEMO_FARM_ID,
                title="과수원 방제 (2일차 오전)",
                start_at=_at(day2, 7),
                end_at=_at(day2, 11),
                required_workers=1,
                required_skills=["방제"],
            ),
            Task(
                id="task_haul",
                farm_id=DEMO_FARM_ID,
                title="수확물 운반 (2일차 오후)",
                start_at=_at(day2, 13),
                end_at=_at(day2, 17),
                required_workers=1,
                required_skills=["운반"],
            ),
        ]
        for task in tasks:
            repo.tasks[task.id] = task

        # 확정된 수확 작업에 가온·마루를 배치해 시간 충돌 사례를 보여 준다.
        for worker_id in ("worker_gaon", "worker_maru"):
            assignment = Assignment(
                id=f"asg_harvest_{worker_id}",
                task_id="task_harvest",
                worker_id=worker_id,
                status=AssignmentStatus.CONFIRMED,
                match_reasons=["데모 확정 배치"],
                created_at=now,
            )
            repo.assignments[assignment.id] = assignment


def demo_payload(repo: InMemoryRepository) -> DemoPayload:
    with repo.lock:
        return DemoPayload(
            notice=DEMO_NOTICE,
            farms=list(repo.farms.values()),
            workers=sorted(repo.workers.values(), key=lambda w: w.display_name),
            tasks=list_task_views(repo),
        )
