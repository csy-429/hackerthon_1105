from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.agent.planner import AgentPlanner, create_default_planner
from app.api.router import api_router
from app.errors import DomainError
from app.repositories.memory import InMemoryRepository
from app.services.demo import load_demo

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def _error_body(code: str, message: str, details: dict | None = None) -> dict:
    return {"detail": {"code": code, "message": message, "details": details or {}}}


def create_app(
    repo: InMemoryRepository | None = None,
    planner: AgentPlanner | None = None,
    serve_frontend: bool = True,
) -> FastAPI:
    app = FastAPI(title="일손잇다 API", version="0.1.0")
    app.state.repo = repo or InMemoryRepository()
    app.state.planner = planner if planner is not None else create_default_planner()
    load_demo(app.state.repo)

    @app.exception_handler(DomainError)
    async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content=_error_body(exc.code, exc.message, exc.details)
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(part) for part in err["loc"][1:]),
                "message": str(err["msg"]).removeprefix("Value error, "),
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_error_body("validation_error", "입력값을 확인하세요", {"errors": errors}),
        )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router)

    if serve_frontend and FRONTEND_DIST.is_dir():
        app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
    return app


app = create_app()
