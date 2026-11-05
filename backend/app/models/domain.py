import re
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
    APPLIED = "applied"
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CONFIRMED = "confirmed"


class WorkerStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class WorkerOrigin(StrEnum):
    ROSTER = "roster"  # 농장주가 이미 아는 일손
    PUBLIC = "public"  # 공개 모집에 직접 지원하는 일손


# APPLIED(지원함)는 인원을 차지하지 않는다. 농장주가 선택해야 활성 배치가 된다.
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


CONTACT_PATTERN = re.compile(r"\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}|[^\s@]+@[^\s@]+\.[^\s@]+")


def reject_contact_info(value: str) -> str:
    # MVP는 전화번호·이메일 같은 직접 식별 정보를 받지 않는다.
    if CONTACT_PATTERN.search(value):
        raise ValueError("전화번호·이메일 등 연락처는 입력할 수 없습니다")
    return value


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
    origin: WorkerOrigin = WorkerOrigin.ROSTER
    experience: str = ""
    intro: str = ""
    desired_hourly_wage: int | None = None


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
    open_recruitment: bool = False
    hourly_wage: int | None = None


class Assignment(BaseModel):
    id: str
    task_id: str
    worker_id: str
    status: AssignmentStatus = AssignmentStatus.PROPOSED
    match_reasons: list[str] = Field(default_factory=list)
    # 조건이 맞지 않는데도 요청·지원한 경우, 당사자가 인지한 사유
    override_reasons: list[str] = Field(default_factory=list)
    created_at: datetime


class Message(BaseModel):
    id: str
    assignment_id: str
    sender: str  # "farmer" | "worker"
    text: str
    created_at: datetime
