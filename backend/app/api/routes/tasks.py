from fastapi import APIRouter, Depends, status

from app.api.deps import get_repository
from app.repositories.memory import InMemoryRepository
from app.schemas.requests import (
    ConfirmationRequest,
    ConfirmRequest,
    TaskCreate,
    TaskUpdate,
)
from app.schemas.responses import SuggestionResult, TaskView
from app.services import assignments as assignment_service
from app.services import tasks as task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskView])
def list_tasks(repo: InMemoryRepository = Depends(get_repository)) -> list[TaskView]:
    return task_service.list_task_views(repo)


@router.post("", response_model=TaskView, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate, repo: InMemoryRepository = Depends(get_repository)
) -> TaskView:
    return task_service.create_task(repo, payload)


@router.get("/{task_id}", response_model=TaskView)
def get_task(task_id: str, repo: InMemoryRepository = Depends(get_repository)) -> TaskView:
    return task_service.get_task_view(repo, task_id)


@router.patch("/{task_id}", response_model=TaskView)
def update_task(
    task_id: str, payload: TaskUpdate, repo: InMemoryRepository = Depends(get_repository)
) -> TaskView:
    return task_service.update_task(repo, task_id, payload)


@router.post("/{task_id}/cancel", response_model=TaskView)
def cancel_task(task_id: str, repo: InMemoryRepository = Depends(get_repository)) -> TaskView:
    return task_service.cancel_task(repo, task_id)


@router.post("/{task_id}/suggestions", response_model=SuggestionResult)
def suggest(
    task_id: str, repo: InMemoryRepository = Depends(get_repository)
) -> SuggestionResult:
    return task_service.suggest_for_task(repo, task_id)


@router.post("/{task_id}/request-confirmation", response_model=TaskView)
def request_confirmation(
    task_id: str,
    payload: ConfirmationRequest,
    repo: InMemoryRepository = Depends(get_repository),
) -> TaskView:
    return assignment_service.request_confirmation(repo, task_id, payload.worker_ids)


@router.post("/{task_id}/confirm", response_model=TaskView)
def confirm_task(
    task_id: str,
    payload: ConfirmRequest,
    repo: InMemoryRepository = Depends(get_repository),
) -> TaskView:
    return assignment_service.confirm_task(repo, task_id, payload.farmer_approved)
