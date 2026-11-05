from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class TaskStatus(StrEnum):
    DRAFT = "draft"
    PROPOSED = "proposed"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AssignmentStatus(StrEnum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CONFIRMED = "confirmed"


class WorkerStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


ACTIVE_ASSIGNMENT_STATUSES = frozenset(
    {AssignmentStatus.PROPOSED, AssignmentStatus.ACCEPTED, AssignmentStatus.CONFIRMED}
)


def require_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        raise ValueError("시간대 정보 없이 현지 시간으로 입력하세요")
    return value


def normalize_skills(skills: list[str]) -> list[str]:
    normalized: list[str] = []
    for skill in skills:
        cleaned = skill.strip()
        if not cleaned:
            raise ValueError("작업 유형은 비어 있을 수 없습니다")
        if len(cleaned) > 20:
            raise ValueError("작업 유형은 20자 이하여야 합니다")
        if cleaned not in normalized:
            normalized.append(cleaned)
    return normalized


class TimeWindow(BaseModel):
    start: datetime
    end: datetime

    @model_validator(mode="after")
    def _check_range(self) -> "TimeWindow":
        require_naive(self.start)
        require_naive(self.end)
        if self.end <= self.start:
            raise ValueError("종료 시각은 시작 시각보다 늦어야 합니다")
        return self


class Farm(BaseModel):
    id: str
    name: str
    region_label: str
    created_at: datetime


class Worker(BaseModel):
    id: str
    display_name: str
    skills: list[str] = Field(default_factory=list)
    availability: list[TimeWindow] = Field(default_factory=list)
    status: WorkerStatus = WorkerStatus.ACTIVE


class Task(BaseModel):
    id: str
    farm_id: str
    title: str
    description: str = ""
    start_at: datetime
    end_at: datetime
    required_workers: int
    required_skills: list[str] = Field(default_factory=list)
    status: TaskStatus = TaskStatus.DRAFT


class Assignment(BaseModel):
    id: str
    task_id: str
    worker_id: str
    status: AssignmentStatus = AssignmentStatus.PROPOSED
    match_reasons: list[str] = Field(default_factory=list)
    created_at: datetime
