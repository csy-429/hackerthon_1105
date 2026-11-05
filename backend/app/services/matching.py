from collections.abc import Iterable
from datetime import datetime

from app.models.domain import (
    ACTIVE_ASSIGNMENT_STATUSES,
    Assignment,
    AssignmentStatus,
    Task,
    TaskStatus,
    TimeWindow,
    Worker,
    WorkerOrigin,
    WorkerStatus,
)
from app.schemas.responses import Candidate, ConflictInfo, SuggestionResult


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    # 경계 시각이 맞닿는 경우(종료 == 시작)는 겹치지 않는 것으로 본다.
    return a_start < b_end and b_start < a_end


def merge_windows(windows: Iterable[TimeWindow]) -> list[TimeWindow]:
    merged: list[TimeWindow] = []
    for window in sorted(windows, key=lambda w: w.start):
        if merged and window.start <= merged[-1].end:
            if window.end > merged[-1].end:
                merged[-1] = TimeWindow(start=merged[-1].start, end=window.end)
        else:
            merged.append(window)
    return merged


def covers(windows: Iterable[TimeWindow], start: datetime, end: datetime) -> bool:
    return any(w.start <= start and w.end >= end for w in merge_windows(windows))


def _span(start: datetime, end: datetime) -> str:
    return f"{start:%m-%d %H:%M} ~ {end:%m-%d %H:%M}"


def evaluate_candidate(
    task: Task,
    worker: Worker,
    tasks: dict[str, Task],
    assignments: Iterable[Assignment],
) -> Candidate:
    reasons: list[str] = []
    warnings: list[str] = []
    exclusions: list[str] = []
    conflicts: list[ConflictInfo] = []
    own_status: AssignmentStatus | None = None

    if task.status == TaskStatus.CANCELLED:
        exclusions.append("취소된 작업입니다")
    if worker.status != WorkerStatus.ACTIVE:
        exclusions.append("비활성 상태의 일손입니다")

    missing = [skill for skill in task.required_skills if skill not in worker.skills]
    if missing:
        exclusions.append(f"필요한 작업 유형이 없습니다: {', '.join(missing)}")
    elif task.required_skills:
        reasons.append(f"필요한 작업 유형을 모두 갖췄습니다: {', '.join(task.required_skills)}")

    if covers(worker.availability, task.start_at, task.end_at):
        reasons.append(
            f"가능 시간이 작업 시간({_span(task.start_at, task.end_at)})을 모두 포함합니다"
        )
    elif any(overlaps(w.start, w.end, task.start_at, task.end_at) for w in worker.availability):
        exclusions.append("가능 시간이 작업 시간의 일부만 포함합니다")
    else:
        exclusions.append("등록된 가능 시간이 작업 시간과 겹치지 않습니다")

    for assignment in assignments:
        if assignment.worker_id != worker.id:
            continue
        if assignment.task_id == task.id:
            if assignment.status == AssignmentStatus.DECLINED:
                exclusions.append("이 작업의 배치를 이미 거절했습니다")
            else:
                own_status = assignment.status
            continue
        other = tasks.get(assignment.task_id)
        if other is None or other.status == TaskStatus.CANCELLED:
            continue
        if assignment.status not in ACTIVE_ASSIGNMENT_STATUSES:
            continue
        if not overlaps(task.start_at, task.end_at, other.start_at, other.end_at):
            continue
        label = f"{other.title} ({_span(other.start_at, other.end_at)})"
        if assignment.status == AssignmentStatus.CONFIRMED:
            exclusions.append(f"확정된 다른 작업과 시간이 겹칩니다: {label}")
            conflicts.append(
                ConflictInfo(
                    task_id=other.id,
                    title=other.title,
                    start_at=other.start_at,
                    end_at=other.end_at,
                )
            )
        else:
            warnings.append(f"배치 요청 중인 다른 작업과 시간이 겹칩니다: {label}")

    eligible = not exclusions
    score = max(0, 100 - 10 * len(warnings)) if eligible else 0
    return Candidate(
        candidate_id=worker.id,
        display_name=worker.display_name,
        eligible=eligible,
        score=score,
        reasons=reasons,
        warnings=warnings,
        exclusions=exclusions,
        conflicts=conflicts,
        assignment_status=own_status,
        origin=worker.origin,
        experience=worker.experience,
        intro=worker.intro,
    )


def suggest_candidates(
    task: Task,
    workers: Iterable[Worker],
    tasks: dict[str, Task],
    assignments: list[Assignment],
) -> SuggestionResult:
    # 공개 일손은 이 작업에 지원(또는 배치)한 경우에만 후보 풀에 들어온다.
    in_task = {a.worker_id for a in assignments if a.task_id == task.id}
    pool = [w for w in workers if w.origin == WorkerOrigin.ROSTER or w.id in in_task]
    candidates = [evaluate_candidate(task, worker, tasks, assignments) for worker in pool]
    candidates.sort(key=lambda c: (not c.eligible, -c.score, c.display_name))

    active = sum(
        1 for a in assignments if a.task_id == task.id and a.status in ACTIVE_ASSIGNMENT_STATUSES
    )
    new_eligible = sum(
        1
        for c in candidates
        if c.eligible and c.assignment_status in (None, AssignmentStatus.APPLIED)
    )
    shortage = max(0, task.required_workers - active - new_eligible)
    reason = None
    if shortage:
        reason = (
            f"필요 인원 {task.required_workers}명 중 이미 배치 요청된 {active}명과 "
            f"배치 가능한 후보 {new_eligible}명을 합쳐도 {shortage}명이 부족합니다"
        )
    return SuggestionResult(
        task_id=task.id,
        required_workers=task.required_workers,
        active_assignments=active,
        candidates=candidates,
        shortage=shortage,
        shortage_reason=reason,
    )
