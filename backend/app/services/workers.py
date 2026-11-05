from app.models.domain import ACTIVE_ASSIGNMENT_STATUSES, TaskStatus, Worker, WorkerOrigin
from app.repositories.memory import InMemoryRepository
from app.schemas.requests import WorkerCreate, WorkerUpdate
from app.schemas.responses import OpportunityView
from app.services.auth import set_pin
from app.services.matching import evaluate_candidate


def list_workers(repo: InMemoryRepository) -> list[Worker]:
    with repo.lock:
        return sorted(repo.workers.values(), key=lambda w: w.display_name)


def create_worker(
    repo: InMemoryRepository,
    payload: WorkerCreate,
    origin: WorkerOrigin = WorkerOrigin.ROSTER,
) -> Worker:
    with repo.lock:
        worker = Worker(
            id=repo.new_id("worker"), origin=origin, **payload.model_dump(exclude={"pin"})
        )
        repo.workers[worker.id] = worker
        set_pin(repo, "worker", worker.id, payload.pin)
        return worker


def list_opportunities(repo: InMemoryRepository, worker_id: str) -> list[OpportunityView]:
    with repo.lock:
        worker = repo.get_worker(worker_id)
        assignments = list(repo.assignments.values())
        result: list[OpportunityView] = []
        for task in sorted(repo.tasks.values(), key=lambda t: (t.start_at, t.title)):
            if not task.open_recruitment or task.status not in (
                TaskStatus.DRAFT,
                TaskStatus.PROPOSED,
            ):
                continue
            active = sum(
                1
                for a in assignments
                if a.task_id == task.id and a.status in ACTIVE_ASSIGNMENT_STATUSES
            )
            free = task.required_workers - active
            if free <= 0:
                continue
            evaluation = evaluate_candidate(task, worker, repo.tasks, assignments)
            result.append(OpportunityView(task=task, evaluation=evaluation, free_slots=free))
        return result


def update_worker(repo: InMemoryRepository, worker_id: str, payload: WorkerUpdate) -> Worker:
    with repo.lock:
        worker = repo.get_worker(worker_id)
        changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
        updated = worker.model_copy(update=changes)
        repo.workers[worker_id] = updated
        return updated
