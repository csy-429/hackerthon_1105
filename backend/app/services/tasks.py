from app.errors import ConflictError, DomainError
from app.models.domain import (
    ACTIVE_ASSIGNMENT_STATUSES,
    AssignmentStatus,
    Task,
    TaskStatus,
)
from app.repositories.memory import InMemoryRepository
from app.schemas.requests import TaskCreate, TaskUpdate
from app.schemas.responses import AssignmentView, SuggestionResult, TaskView
from app.services.matching import suggest_candidates

SCHEDULING_FIELDS = ("start_at", "end_at", "required_workers", "required_skills")


def build_task_view(repo: InMemoryRepository, task: Task) -> TaskView:
    assignments = repo.assignments_for_task(task.id)
    views = [
        AssignmentView(**a.model_dump(), worker_name=repo.get_worker(a.worker_id).display_name)
        for a in assignments
    ]
    return TaskView(
        **task.model_dump(),
        assignments=views,
        active_count=sum(1 for a in assignments if a.status in ACTIVE_ASSIGNMENT_STATUSES),
        accepted_count=sum(1 for a in assignments if a.status == AssignmentStatus.ACCEPTED),
        confirmed_count=sum(1 for a in assignments if a.status == AssignmentStatus.CONFIRMED),
    )


def list_task_views(repo: InMemoryRepository) -> list[TaskView]:
    with repo.lock:
        tasks = sorted(repo.tasks.values(), key=lambda t: (t.start_at, t.title))
        return [build_task_view(repo, t) for t in tasks]


def get_task_view(repo: InMemoryRepository, task_id: str) -> TaskView:
    with repo.lock:
        return build_task_view(repo, repo.get_task(task_id))


def create_task(repo: InMemoryRepository, payload: TaskCreate) -> TaskView:
    with repo.lock:
        repo.get_farm(payload.farm_id)
        task = Task(id=repo.new_id("task"), **payload.model_dump())
        repo.tasks[task.id] = task
        return build_task_view(repo, task)


def update_task(repo: InMemoryRepository, task_id: str, payload: TaskUpdate) -> TaskView:
    with repo.lock:
        task = repo.get_task(task_id)
        if task.status in (TaskStatus.CANCELLED, TaskStatus.COMPLETED):
            raise ConflictError("task_not_editable", "취소되었거나 완료된 작업은 수정할 수 없습니다")

        changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
        start_at = changes.get("start_at", task.start_at)
        end_at = changes.get("end_at", task.end_at)
        if end_at <= start_at:
            raise DomainError(422, "invalid_time_range", "종료 시각은 시작 시각보다 늦어야 합니다")

        scheduling_changed = any(
            field in changes and changes[field] != getattr(task, field)
            for field in SCHEDULING_FIELDS
        )
        if scheduling_changed and task.status == TaskStatus.CONFIRMED:
            raise ConflictError(
                "confirmed_task_locked",
                "확정된 작업의 일정·인원·조건은 수정할 수 없습니다. 작업을 취소한 뒤 새로 등록하세요",
            )

        updated = task.model_copy(update=changes)
        if scheduling_changed and task.status == TaskStatus.PROPOSED:
            # 조건이 바뀌면 기존 배치 요청은 근거가 사라지므로 폐기하고 초안으로 되돌린다.
            for assignment in repo.assignments_for_task(task.id):
                if assignment.status in ACTIVE_ASSIGNMENT_STATUSES:
                    del repo.assignments[assignment.id]
            updated.status = TaskStatus.DRAFT
        repo.tasks[task.id] = updated
        return build_task_view(repo, updated)


def cancel_task(repo: InMemoryRepository, task_id: str) -> TaskView:
    with repo.lock:
        task = repo.get_task(task_id)
        if task.status in (TaskStatus.CANCELLED, TaskStatus.COMPLETED):
            raise ConflictError("task_not_cancellable", "이미 취소되었거나 완료된 작업입니다")
        task.status = TaskStatus.CANCELLED
        return build_task_view(repo, task)


def suggest_for_task(repo: InMemoryRepository, task_id: str) -> SuggestionResult:
    with repo.lock:
        task = repo.get_task(task_id)
        return suggest_candidates(
            task,
            repo.workers.values(),
            repo.tasks,
            list(repo.assignments.values()),
        )
