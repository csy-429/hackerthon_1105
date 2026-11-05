from datetime import datetime
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models.domain import TimeWindow, WorkerStatus, normalize_skills, require_naive

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class _Strict(BaseModel):
    # 클라이언트가 status 같은 서버 관리 필드를 보내면 거부한다.
    model_config = ConfigDict(extra="forbid")


class TaskCreate(_Strict):
    farm_id: str
    title: Title
    description: str = Field(default="", max_length=1000)
    start_at: datetime
    end_at: datetime
    required_workers: int = Field(default=1, ge=1, le=50)
    required_skills: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("start_at", "end_at")
    @classmethod
    def _naive(cls, value: datetime) -> datetime:
        return require_naive(value)

    @field_validator("required_skills")
    @classmethod
    def _skills(cls, value: list[str]) -> list[str]:
        return normalize_skills(value)

    @model_validator(mode="after")
    def _range(self) -> "TaskCreate":
        if self.end_at <= self.start_at:
            raise ValueError("종료 시각은 시작 시각보다 늦어야 합니다")
        return self


class TaskUpdate(_Strict):
    title: Title | None = None
    description: str | None = Field(default=None, max_length=1000)
    start_at: datetime | None = None
    end_at: datetime | None = None
    required_workers: int | None = Field(default=None, ge=1, le=50)
    required_skills: list[str] | None = Field(default=None, max_length=20)

    @field_validator("start_at", "end_at")
    @classmethod
    def _naive(cls, value: datetime | None) -> datetime | None:
        return require_naive(value) if value is not None else None

    @field_validator("required_skills")
    @classmethod
    def _skills(cls, value: list[str] | None) -> list[str] | None:
        return normalize_skills(value) if value is not None else None


class WorkerCreate(_Strict):
    display_name: PersonName
    skills: list[str] = Field(default_factory=list, max_length=20)
    availability: list[TimeWindow] = Field(default_factory=list, max_length=50)

    @field_validator("skills")
    @classmethod
    def _skills(cls, value: list[str]) -> list[str]:
        return normalize_skills(value)


class WorkerUpdate(_Strict):
    display_name: PersonName | None = None
    skills: list[str] | None = Field(default=None, max_length=20)
    availability: list[TimeWindow] | None = Field(default=None, max_length=50)
    status: WorkerStatus | None = None

    @field_validator("skills")
    @classmethod
    def _skills(cls, value: list[str] | None) -> list[str] | None:
        return normalize_skills(value) if value is not None else None


class ConfirmationRequest(_Strict):
    worker_ids: list[str] = Field(min_length=1, max_length=50)


class ConfirmRequest(_Strict):
    farmer_approved: bool


class AgentPlanRequest(_Strict):
    task_id: str
    request: str = Field(default="", max_length=1000)
