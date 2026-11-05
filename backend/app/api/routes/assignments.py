from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.api.deps import get_repository
from app.models.domain import Message
from app.repositories.memory import InMemoryRepository
from app.schemas.requests import MessageCreate, WageOfferCreate
from app.schemas.responses import AssignmentView
from app.services import assignments as assignment_service

router = APIRouter(prefix="/assignments", tags=["assignments"])

PinHeader = Annotated[str | None, Header(alias="X-Pin")]


@router.get("", response_model=list[AssignmentView])
def list_assignments(
    task_id: str | None = None,
    worker_id: str | None = None,
    repo: InMemoryRepository = Depends(get_repository),
) -> list[AssignmentView]:
    return assignment_service.list_assignments(repo, task_id, worker_id)


@router.post("/{assignment_id}/accept", response_model=AssignmentView)
def accept(
    assignment_id: str,
    x_pin: PinHeader = None,
    repo: InMemoryRepository = Depends(get_repository),
) -> AssignmentView:
    return assignment_service.accept_assignment(repo, assignment_id, x_pin)


@router.post("/{assignment_id}/decline", response_model=AssignmentView)
def decline(
    assignment_id: str,
    x_pin: PinHeader = None,
    repo: InMemoryRepository = Depends(get_repository),
) -> AssignmentView:
    return assignment_service.decline_assignment(repo, assignment_id, x_pin)


@router.get("/{assignment_id}/messages", response_model=list[Message])
def messages(
    assignment_id: str,
    x_pin: PinHeader = None,
    repo: InMemoryRepository = Depends(get_repository),
) -> list[Message]:
    return assignment_service.list_messages(repo, assignment_id, x_pin)


@router.post("/{assignment_id}/wage-offer", response_model=AssignmentView)
def wage_offer(
    assignment_id: str,
    payload: WageOfferCreate,
    x_pin: PinHeader = None,
    repo: InMemoryRepository = Depends(get_repository),
) -> AssignmentView:
    return assignment_service.offer_wage(repo, assignment_id, x_pin, payload.wage)


@router.post("/{assignment_id}/wage-offer/accept", response_model=AssignmentView)
def wage_accept(
    assignment_id: str,
    x_pin: PinHeader = None,
    repo: InMemoryRepository = Depends(get_repository),
) -> AssignmentView:
    return assignment_service.accept_wage(repo, assignment_id, x_pin)


@router.post("/{assignment_id}/messages", response_model=Message, status_code=201)
def send(
    assignment_id: str,
    payload: MessageCreate,
    x_pin: PinHeader = None,
    repo: InMemoryRepository = Depends(get_repository),
) -> Message:
    return assignment_service.send_message(repo, assignment_id, x_pin, payload.text)
