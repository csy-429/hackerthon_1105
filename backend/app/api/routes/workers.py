from fastapi import APIRouter, Depends, status

from app.api.deps import get_repository
from app.models.domain import Worker, WorkerOrigin
from app.repositories.memory import InMemoryRepository
from app.schemas.requests import WorkerCreate, WorkerUpdate
from app.schemas.responses import OpportunityView
from app.services import workers as worker_service

router = APIRouter(prefix="/workers", tags=["workers"])


@router.get("", response_model=list[Worker])
def list_workers(repo: InMemoryRepository = Depends(get_repository)) -> list[Worker]:
    return worker_service.list_workers(repo)


@router.post("", response_model=Worker, status_code=status.HTTP_201_CREATED)
def create_worker(
    payload: WorkerCreate,
    public: bool = False,
    repo: InMemoryRepository = Depends(get_repository),
) -> Worker:
    origin = WorkerOrigin.PUBLIC if public else WorkerOrigin.ROSTER
    return worker_service.create_worker(repo, payload, origin)


@router.get("/{worker_id}/opportunities", response_model=list[OpportunityView])
def opportunities(
    worker_id: str, repo: InMemoryRepository = Depends(get_repository)
) -> list[OpportunityView]:
    return worker_service.list_opportunities(repo, worker_id)


@router.patch("/{worker_id}", response_model=Worker)
def update_worker(
    worker_id: str, payload: WorkerUpdate, repo: InMemoryRepository = Depends(get_repository)
) -> Worker:
    return worker_service.update_worker(repo, worker_id, payload)
