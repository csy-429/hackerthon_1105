from fastapi import APIRouter

from app.api.routes import agent, assignments, demo, tasks, workers

api_router = APIRouter(prefix="/api")
api_router.include_router(demo.router)
api_router.include_router(tasks.router)
api_router.include_router(workers.router)
api_router.include_router(assignments.router)
api_router.include_router(agent.router)
