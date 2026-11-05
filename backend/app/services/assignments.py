from datetime import datetime

from app.errors import ConflictError, DomainError
from app.models.domain import (
    ACTIVE_ASSIGNMENT_STATUSES,
    Assignment,
    AssignmentStatus,
    TaskStatus,
)
from app.repositories.memory import InMemoryRepository
from app.schemas.responses import AssignmentView, TaskView
from app.services.matching import evaluate_candidate
from app.services.tasks import build_task_view


def _view(repo: InMemoryRepository, assignment: Assignment) -> AssignmentView:
    return AssignmentView(
        **assignment.model_dump(), worker_name=repo.get_worker(assignment.worker_id).display_name
    )


def list_assignments(repo: InMemoryRepository, task_id: str | None) -> list[AssignmentView]:
    with repo.lock:
        items = sorted(repo.assignments.values(), key=lambda a: a.created_at)
        return [_view(repo, a) for a in items if task_id is None or a.task_id == task_id]


def request_confirmation(
    repo: InMemoryRepository, task_id: str, worker_ids: list[str]
) -> TaskView:
    """농장주가 검토한 후보에게 배치를 요청한다. 확정은 별도 단계다."""
    with repo.lock:
        task = repo.get_task(task_id)
        if task.status not in (TaskStatus.DRAFT, TaskStatus.PROPOSED):
            raise ConflictError(
                "task_not_requestable", "초안 또는 배치 요청 중인 작업만 요청할 수 있습니다"
            )
        if len(set(worker_ids)) != len(worker_ids):
            raise DomainError(422, "duplicate_workers", "같은 일손을 중복 선택할 수 없습니다")

        existing = repo.assignments_for_task(task.id)
        active = sum(1 for a in existing if a.status in ACTIVE_ASSIGNMENT_STATUSES)
        if active + len(worker_ids) > task.required_workers:
            raise ConflictError(
                "too_many_workers",
                f"필요 인원 {task.required_workers}명을 초과합니다 (현재 요청 {active}명)",
            )

        all_assignments = list(repo.assignments.values())
        new_items: list[Assignment] = []
        for worker_id in worker_ids:
            worker = repo.get_worker(worker_id)
            candidate = evaluate_candidate(task, worker, repo.tasks, all_assignments)
            if candidate.assignment_status is not None:
                raise ConflictError(
                    "already_requested", f"{worker.display_name}에게는 이미 배치를 요청했습니다"
                )
            if not candidate.eligible:
                raise ConflictError(
                    "worker_not_eligible",
                    f"{worker.display_name}은(는) 배치할 수 없습니다",
                    {"exclusions": candidate.exclusions},
                )
            new_items.append(
                Assignment(
                    id=repo.new_id("asg"),
                    task_id=task.id,
                    worker_id=worker.id,
                    match_reasons=candidate.reasons,
                    created_at=datetime.now(),
                )
            )
        for item in new_items:
            repo.assignments[item.id] = item
        task.status = TaskStatus.PROPOSED
        return build_task_view(repo, task)


def _respond(
    repo: InMemoryRepository,
    assignment_id: str,
    allowed_from: set[AssignmentStatus],
    target: AssignmentStatus,
) -> AssignmentView:
    with repo.lock:
        assignment = repo.get_assignment(assignment_id)
        task = repo.get_task(assignment.task_id)
        if task.status != TaskStatus.PROPOSED:
            raise ConflictError("task_not_proposed", "배치 요청 중인 작업에서만 응답할 수 있습니다")
        if assignment.status not in allowed_from:
            raise ConflictError(
                "invalid_transition", f"현재 상태({assignment.status})에서는 변경할 수 없습니다"
            )
        assignment.status = target
        if target == AssignmentStatus.DECLINED and not any(
            a.status in ACTIVE_ASSIGNMENT_STATUSES for a in repo.assignments_for_task(task.id)
        ):
            task.status = TaskStatus.DRAFT
        return _view(repo, assignment)


def accept_assignment(repo: InMemoryRepository, assignment_id: str) -> AssignmentView:
    return _respond(repo, assignment_id, {AssignmentStatus.PROPOSED}, AssignmentStatus.ACCEPTED)


def decline_assignment(repo: InMemoryRepository, assignment_id: str) -> AssignmentView:
    return _respond(
        repo,
        assignment_id,
        {AssignmentStatus.PROPOSED, AssignmentStatus.ACCEPTED},
        AssignmentStatus.DECLINED,
    )


def confirm_task(repo: InMemoryRepository, task_id: str, farmer_approved: bool) -> TaskView:
    with repo.lock:
        if not farmer_approved:
            raise DomainError(400, "approval_required", "농장주의 확정 승인이 필요합니다")
        task = repo.get_task(task_id)
        if task.status != TaskStatus.PROPOSED:
            raise ConflictError("task_not_proposed", "배치 요청 중인 작업만 확정할 수 있습니다")

        active = [
            a for a in repo.assignments_for_task(task.id) if a.status in ACTIVE_ASSIGNMENT_STATUSES
        ]
        if len(active) != task.required_workers:
            raise ConflictError(
                "headcount_mismatch",
                f"필요 인원 {task.required_workers}명 중 {len(active)}명에게만 배치를 요청했습니다",
            )
        pending = [a for a in active if a.status != AssignmentStatus.ACCEPTED]
        if pending:
            names = ", ".join(repo.get_worker(a.worker_id).display_name for a in pending)
            raise ConflictError(
                "workers_not_accepted", f"아직 수락하지 않은 일손이 있습니다: {names}"
            )

        # 요청 이후 다른 작업이 확정됐을 수 있으므로 서버에서 다시 검증한다.
        all_assignments = list(repo.assignments.values())
        problems: dict[str, list[str]] = {}
        for assignment in active:
            worker = repo.get_worker(assignment.worker_id)
            candidate = evaluate_candidate(task, worker, repo.tasks, all_assignments)
            if not candidate.eligible:
                problems[worker.display_name] = candidate.exclusions
        if problems:
            raise ConflictError(
                "revalidation_failed",
                "확정 전 검증에서 충돌이 발견되었습니다",
                {"problems": problems},
            )

        for assignment in active:
            assignment.status = AssignmentStatus.CONFIRMED
        task.status = TaskStatus.CONFIRMED
        return build_task_view(repo, task)
