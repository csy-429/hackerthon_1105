from datetime import datetime

from app.errors import ConflictError, DomainError
from app.models.domain import (
    ACTIVE_ASSIGNMENT_STATUSES,
    Assignment,
    AssignmentStatus,
    Message,
    TaskStatus,
    WorkerOrigin,
)
from app.repositories.memory import InMemoryRepository
from app.schemas.responses import AssignmentView, TaskView
from app.services.auth import match_any, require_pin
from app.services.matching import evaluate_candidate
from app.services.tasks import build_task_view

MAX_MESSAGES = 200


def _view(repo: InMemoryRepository, assignment: Assignment) -> AssignmentView:
    return AssignmentView(
        **assignment.model_dump(), worker_name=repo.get_worker(assignment.worker_id).display_name
    )


def list_assignments(
    repo: InMemoryRepository, task_id: str | None, worker_id: str | None = None
) -> list[AssignmentView]:
    with repo.lock:
        items = sorted(repo.assignments.values(), key=lambda a: a.created_at)
        return [
            _view(repo, a)
            for a in items
            if (task_id is None or a.task_id == task_id)
            and (worker_id is None or a.worker_id == worker_id)
        ]


def request_confirmation(
    repo: InMemoryRepository,
    task_id: str,
    worker_ids: list[str],
    force_worker_ids: list[str] | None = None,
) -> TaskView:
    """농장주가 검토한 후보에게 배치를 요청한다. 확정은 별도 단계다."""
    force_worker_ids = force_worker_ids or []
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
        selected: list[Assignment] = []
        for worker_id in worker_ids:
            worker = repo.get_worker(worker_id)
            candidate = evaluate_candidate(task, worker, repo.tasks, all_assignments)
            applied = next(
                (
                    a
                    for a in existing
                    if a.worker_id == worker.id and a.status == AssignmentStatus.APPLIED
                ),
                None,
            )
            if candidate.assignment_status not in (None, AssignmentStatus.APPLIED):
                raise ConflictError(
                    "already_requested", f"{worker.display_name}에게는 이미 배치를 요청했습니다"
                )
            forced = worker.id in force_worker_ids or bool(applied and applied.override_reasons)
            if not candidate.eligible and not (candidate.requestable and forced):
                raise ConflictError(
                    "worker_not_eligible",
                    f"{worker.display_name}은(는) 배치할 수 없습니다",
                    {"exclusions": candidate.exclusions, "blockers": candidate.blockers},
                )
            override = [] if candidate.eligible else candidate.exclusions
            if applied is not None:
                # 직접 지원은 일손의 사전 동의로 보고 바로 수락 상태로 둔다.
                selected.append(applied)
                continue
            if worker.origin == WorkerOrigin.PUBLIC:
                raise ConflictError(
                    "not_applicant", f"{worker.display_name}은(는) 이 작업에 지원하지 않았습니다"
                )
            new_items.append(
                Assignment(
                    id=repo.new_id("asg"),
                    task_id=task.id,
                    worker_id=worker.id,
                    match_reasons=candidate.reasons,
                    override_reasons=override,
                    created_at=datetime.now(),
                )
            )
        for item in new_items:
            repo.assignments[item.id] = item
        for item in selected:
            item.status = AssignmentStatus.ACCEPTED
            item.match_reasons = [*item.match_reasons, "지원자: 일손이 직접 지원함"]
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
        if assignment.status not in allowed_from:
            raise ConflictError(
                "invalid_transition", f"현재 상태({assignment.status})에서는 변경할 수 없습니다"
            )
        was_applied = assignment.status == AssignmentStatus.APPLIED
        if was_applied:
            if task.status not in (TaskStatus.DRAFT, TaskStatus.PROPOSED):
                raise ConflictError("task_closed", "마감된 작업의 지원은 변경할 수 없습니다")
        elif task.status != TaskStatus.PROPOSED:
            raise ConflictError("task_not_proposed", "배치 요청 중인 작업에서만 응답할 수 있습니다")
        assignment.status = target
        if (
            target == AssignmentStatus.DECLINED
            and not was_applied
            and not any(
                a.status in ACTIVE_ASSIGNMENT_STATUSES for a in repo.assignments_for_task(task.id)
            )
        ):
            task.status = TaskStatus.DRAFT
        return _view(repo, assignment)


def accept_assignment(
    repo: InMemoryRepository, assignment_id: str, pin: str | None = None
) -> AssignmentView:
    require_pin(repo, "worker", repo.get_assignment(assignment_id).worker_id, pin)
    return _respond(repo, assignment_id, {AssignmentStatus.PROPOSED}, AssignmentStatus.ACCEPTED)


def decline_assignment(
    repo: InMemoryRepository, assignment_id: str, pin: str | None = None
) -> AssignmentView:
    assignment = repo.get_assignment(assignment_id)
    # 일손 본인 또는 작업 주인 누구든 거절·취소할 수 있다.
    if not pin:
        raise DomainError(401, "pin_required", "비밀번호 4자리를 입력하세요")
    if (
        match_any(
            repo, [("worker", assignment.worker_id), ("task", assignment.task_id)], pin
        )
        is None
    ):
        raise DomainError(403, "invalid_pin", "비밀번호가 올바르지 않습니다")
    return _respond(
        repo,
        assignment_id,
        {AssignmentStatus.APPLIED, AssignmentStatus.PROPOSED, AssignmentStatus.ACCEPTED},
        AssignmentStatus.DECLINED,
    )


def apply_to_task(
    repo: InMemoryRepository, task_id: str, worker_id: str, force: bool = False
) -> AssignmentView:
    with repo.lock:
        task = repo.get_task(task_id)
        worker = repo.get_worker(worker_id)
        if not task.open_recruitment:
            raise ConflictError("not_open", "공개 모집 중인 작업이 아닙니다")
        if task.status not in (TaskStatus.DRAFT, TaskStatus.PROPOSED):
            raise ConflictError("task_closed", "마감되었거나 취소된 작업입니다")
        candidate = evaluate_candidate(task, worker, repo.tasks, list(repo.assignments.values()))
        if candidate.assignment_status is not None:
            raise ConflictError("already_applied", "이미 지원했거나 배치된 작업입니다")
        if not candidate.eligible and not (force and candidate.requestable):
            raise ConflictError(
                "worker_not_eligible",
                "지원 조건을 충족하지 않습니다",
                {"exclusions": candidate.exclusions, "blockers": candidate.blockers},
            )
        assignment = Assignment(
            id=repo.new_id("asg"),
            task_id=task.id,
            worker_id=worker.id,
            status=AssignmentStatus.APPLIED,
            match_reasons=candidate.reasons,
            override_reasons=[] if candidate.eligible else candidate.exclusions,
            created_at=datetime.now(),
        )
        repo.assignments[assignment.id] = assignment
        return _view(repo, assignment)


def _party(repo: InMemoryRepository, assignment: Assignment, pin: str | None) -> str:
    """PIN으로 대화 당사자를 판별한다. 일손 PIN이면 worker, 작업 PIN이면 farmer."""
    if not pin:
        raise DomainError(401, "pin_required", "비밀번호 4자리를 입력하세요")
    index = match_any(
        repo, [("worker", assignment.worker_id), ("task", assignment.task_id)], pin
    )
    if index is None:
        raise DomainError(403, "invalid_pin", "비밀번호가 올바르지 않습니다")
    return "worker" if index == 0 else "farmer"


def list_messages(
    repo: InMemoryRepository, assignment_id: str, pin: str | None
) -> list[Message]:
    with repo.lock:
        assignment = repo.get_assignment(assignment_id)
        _party(repo, assignment, pin)
        return sorted(
            (m for m in repo.messages.values() if m.assignment_id == assignment.id),
            key=lambda m: m.created_at,
        )


def send_message(
    repo: InMemoryRepository, assignment_id: str, pin: str | None, text: str
) -> Message:
    with repo.lock:
        assignment = repo.get_assignment(assignment_id)
        sender = _party(repo, assignment, pin)
        if assignment.status == AssignmentStatus.DECLINED:
            raise ConflictError("chat_closed", "거절·취소된 배치에서는 메시지를 보낼 수 없습니다")
        if sum(1 for m in repo.messages.values() if m.assignment_id == assignment.id) >= (
            MAX_MESSAGES
        ):
            raise ConflictError("chat_full", f"메시지는 최대 {MAX_MESSAGES}개까지 보낼 수 있습니다")
        message = Message(
            id=repo.new_id("msg"),
            assignment_id=assignment.id,
            sender=sender,
            text=text,
            created_at=datetime.now(),
        )
        repo.messages[message.id] = message
        return message


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
            if not (candidate.eligible or (assignment.override_reasons and candidate.requestable)):
                problems[worker.display_name] = candidate.blockers or candidate.exclusions
        if problems:
            raise ConflictError(
                "revalidation_failed",
                "확정 전 검증에서 충돌이 발견되었습니다",
                {"problems": problems},
            )

        for assignment in active:
            assignment.status = AssignmentStatus.CONFIRMED
        for assignment in repo.assignments_for_task(task.id):
            if assignment.status == AssignmentStatus.APPLIED:
                assignment.status = AssignmentStatus.DECLINED
        task.status = TaskStatus.CONFIRMED
        return build_task_view(repo, task)
