import logging

from fastapi import APIRouter, Depends

from app.agent.planner import AgentPlanner, AgentUnavailableError
from app.api.deps import get_planner, get_repository
from app.api.ratelimit import agent_rate_limit
from app.errors import DomainError
from app.repositories.memory import InMemoryRepository
from app.schemas.requests import AgentPlanRequest
from app.schemas.responses import AgentPlanResponse, AgentPlanResult
from app.services.tasks import suggest_for_task

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/plan", response_model=AgentPlanResponse, dependencies=[Depends(agent_rate_limit)])
async def plan(
    payload: AgentPlanRequest,
    repo: InMemoryRepository = Depends(get_repository),
    planner: AgentPlanner = Depends(get_planner),
) -> AgentPlanResponse:
    with repo.lock:
        task = repo.get_task(payload.task_id)
        suggestions = suggest_for_task(repo, task.id)

    try:
        result = await planner.plan(task, suggestions, payload.request)
    except AgentUnavailableError as exc:
        raise DomainError(
            503,
            "agent_unavailable",
            "AI 설명을 지금은 사용할 수 없습니다. 후보 필터링과 충돌 검사는 정상 동작합니다. 잠시 후 다시 시도하세요",
            {"retryable": True},
        ) from exc
    except Exception as exc:
        logger.exception("agent planner failed")
        raise DomainError(
            502, "agent_failed", "AI 처리 중 오류가 발생했습니다. 다시 시도하세요", {"retryable": True}
        ) from exc

    if not isinstance(result, AgentPlanResult):
        raise DomainError(502, "agent_invalid_output", "AI 응답 형식이 올바르지 않아 폐기했습니다")
    known_ids = {c.candidate_id for c in suggestions.candidates}
    if not set(result.referenced_worker_ids) <= known_ids:
        raise DomainError(
            502,
            "agent_invalid_output",
            "AI가 매칭 결과에 없는 일손을 언급해 응답을 폐기했습니다",
        )

    return AgentPlanResponse(
        task_id=task.id,
        summary=result.summary,
        referenced_worker_ids=result.referenced_worker_ids,
        suggestions=suggestions,
    )
