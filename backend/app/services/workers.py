from app.models.domain import Worker
from app.repositories.memory import InMemoryRepository
from app.schemas.requests import WorkerCreate, WorkerUpdate


def list_workers(repo: InMemoryRepository) -> list[Worker]:
    with repo.lock:
        return sorted(repo.workers.values(), key=lambda w: w.display_name)


def create_worker(repo: InMemoryRepository, payload: WorkerCreate) -> Worker:
    with repo.lock:
        worker = Worker(id=repo.new_id("worker"), **payload.model_dump())
        repo.workers[worker.id] = worker
        return worker


def update_worker(repo: InMemoryRepository, worker_id: str, payload: WorkerUpdate) -> Worker:
    with repo.lock:
        worker = repo.get_worker(worker_id)
        changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
        updated = worker.model_copy(update=changes)
        repo.workers[worker_id] = updated
        return updated
