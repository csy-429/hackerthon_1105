from fastapi import Request

from app.agent.planner import AgentPlanner
from app.repositories.memory import InMemoryRepository


def get_repository(request: Request) -> InMemoryRepository:
    return request.app.state.repo


def get_planner(request: Request) -> AgentPlanner:
    return request.app.state.planner
