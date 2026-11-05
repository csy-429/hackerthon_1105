from fastapi import APIRouter, Depends

from app.api.deps import get_repository
from app.repositories.memory import InMemoryRepository
from app.schemas.responses import DemoPayload
from app.services.demo import demo_payload, load_demo

router = APIRouter(prefix="/demo", tags=["demo"])


@router.get("", response_model=DemoPayload)
def get_demo(repo: InMemoryRepository = Depends(get_repository)) -> DemoPayload:
    return demo_payload(repo)


@router.post("/reset", response_model=DemoPayload)
def reset_demo(repo: InMemoryRepository = Depends(get_repository)) -> DemoPayload:
    load_demo(repo)
    return demo_payload(repo)
