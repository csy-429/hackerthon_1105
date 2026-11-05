import hashlib
import hmac
import os
import time

from app.errors import DomainError
from app.repositories.memory import InMemoryRepository, PinRecord

MAX_FAILURES = 5
LOCK_SECONDS = 300
_ITERATIONS = 20_000


def _digest(pin: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), salt, _ITERATIONS)


def _key(kind: str, target_id: str) -> str:
    return f"{kind}:{target_id}"


def set_pin(repo: InMemoryRepository, kind: str, target_id: str, pin: str) -> None:
    salt = os.urandom(16)
    repo.pins[_key(kind, target_id)] = PinRecord(salt=salt, digest=_digest(pin, salt))


def _verify(record: PinRecord, pin: str) -> bool:
    return hmac.compare_digest(record.digest, _digest(pin, record.salt))


def _register_failure(record: PinRecord, now: float) -> None:
    record.failures += 1
    if record.failures >= MAX_FAILURES:
        record.failures = 0
        record.locked_until = now + LOCK_SECONDS


def match_any(
    repo: InMemoryRepository, targets: list[tuple[str, str]], pin: str | None
) -> int | None:
    """여러 대상 중 PIN이 일치하는 첫 대상의 인덱스를 반환한다.

    모두 불일치할 때만 실패 횟수를 올려, 상대방 PIN으로 정상 접근해도 잠기지 않게 한다.
    """
    if not pin:
        return None
    now = time.time()
    records = [repo.pins.get(_key(kind, target_id)) for kind, target_id in targets]
    if any(r is not None and r.locked_until > now for r in records):
        raise DomainError(
            429, "pin_locked", "비밀번호를 여러 번 틀려 잠시 잠겼습니다. 잠시 후 다시 시도하세요"
        )
    for index, record in enumerate(records):
        if record is not None and _verify(record, pin):
            record.failures = 0
            return index
    for record in records:
        if record is not None:
            _register_failure(record, now)
    return None


def check_pin(repo: InMemoryRepository, kind: str, target_id: str, pin: str | None) -> bool:
    """비밀번호 일치 여부를 반환한다. 잠금 상태면 429를 낸다."""
    return match_any(repo, [(kind, target_id)], pin) is not None


def require_pin(repo: InMemoryRepository, kind: str, target_id: str, pin: str | None) -> None:
    if not pin:
        raise DomainError(401, "pin_required", "비밀번호 4자리를 입력하세요")
    if not check_pin(repo, kind, target_id, pin):
        raise DomainError(403, "invalid_pin", "비밀번호가 올바르지 않습니다")
