from fastapi import APIRouter, Depends

from app.api.deps import get_repository
from app.repositories.memory import InMemoryRepository
from app.schemas.responses import AssignmentView
from app.services import assignments as assignment_service

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("", response_model=list[AssignmentView])
def list_assignments(
    task_id: str | None = None,
    worker_id: str | None = None,
    repo: InMemoryRepository = Depends(get_repository),
) -> list[AssignmentView]:
    return assignment_service.list_assignments(repo, task_id, worker_id)


@router.post("/{assignment_id}/accept", response_model=AssignmentView)
def accept(
    assignment_id: str, repo: InMemoryRepository = Depends(get_repository)
) -> AssignmentView:
    return assignment_service.accept_assignment(repo, assignment_id)


@router.post("/{assignment_id}/decline", response_model=AssignmentView)
def decline(
    assignment_id: str, repo: InMemoryRepository = Depends(get_repository)
) -> AssignmentView:
    return assignment_service.decline_assignment(repo, assignment_id)
