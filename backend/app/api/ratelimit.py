import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request

from app.errors import DomainError


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> float | None:
        """허용되면 None, 초과하면 다시 시도할 때까지 남은 초를 돌려준다."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return self.window - (now - hits[0])
            hits.append(now)
            return None


def client_key(request: Request) -> str:
    # App Service 프록시 뒤에서는 실제 클라이언트가 X-Forwarded-For 첫 값에 있다
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip().split(":")[0]
    return request.client.host if request.client else "unknown"


def agent_rate_limit(request: Request) -> None:
    limiter: SlidingWindowLimiter = request.app.state.agent_limiter
    wait = limiter.check(client_key(request))
    if wait is not None:
        raise DomainError(
            429,
            "rate_limited",
            f"AI 요청이 너무 잦습니다. {int(wait) + 1}초 뒤에 다시 시도하세요",
            {"retryable": True},
        )
