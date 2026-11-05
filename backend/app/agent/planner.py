from typing import Protocol

from app.models.domain import Task
from app.schemas.responses import AgentPlanResult, SuggestionResult


class AgentUnavailableError(Exception):
    """AI 에이전트를 사용할 수 없을 때 발생한다. 가짜 성공 결과로 대체하지 않는다."""


class AgentPlanner(Protocol):
    def plan(self, task: Task, suggestions: SuggestionResult, request: str) -> AgentPlanResult:
        """결정적 매칭 결과를 설명하는 초안을 만든다. 후보나 적격성은 바꿀 수 없다."""
        ...


class UnconfiguredPlanner:
    def plan(self, task: Task, suggestions: SuggestionResult, request: str) -> AgentPlanResult:
        raise AgentUnavailableError("AI 에이전트가 아직 연결되지 않았습니다")
