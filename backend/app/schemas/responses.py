from datetime import datetime

from pydantic import BaseModel, Field

from app.models.domain import Assignment, AssignmentStatus, Farm, Task, Worker


class ConflictInfo(BaseModel):
    task_id: str
    title: str
    start_at: datetime
    end_at: datetime


class Candidate(BaseModel):
    candidate_id: str
    display_name: str
    eligible: bool
    score: int
    reasons: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)
    conflicts: list[ConflictInfo] = Field(default_factory=list)
    assignment_status: AssignmentStatus | None = None


class SuggestionResult(BaseModel):
    task_id: str
    required_workers: int
    active_assignments: int
    candidates: list[Candidate]
    shortage: int
    shortage_reason: str | None = None
    is_ai_generated: bool = False


class AssignmentView(Assignment):
    worker_name: str


class TaskView(Task):
    assignments: list[AssignmentView] = Field(default_factory=list)
    active_count: int = 0
    accepted_count: int = 0
    confirmed_count: int = 0


class DemoPayload(BaseModel):
    notice: str
    farms: list[Farm]
    workers: list[Worker]
    tasks: list[TaskView]


class AgentPlanResult(BaseModel):
    summary: str = Field(min_length=1, max_length=2000)
    referenced_worker_ids: list[str] = Field(default_factory=list)


class AgentPlanResponse(BaseModel):
    task_id: str
    summary: str
    referenced_worker_ids: list[str]
    is_draft: bool = True
    suggestions: SuggestionResult
