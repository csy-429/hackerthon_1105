# hackerthon_1105

청도 바이브코딩 해커톤 제출용 레포지토리입니다.

## 기획 문서

- [PRD.md](./PRD.md) — 제품 요구사항 및 MVP 범위
- [TRD.md](./TRD.md) — 기술 구조, 데이터 모델, API 초안
- [TDD.md](./TDD.md) — 테스트 설계 및 MVP 검증 기준

> TDD는 Test Design Document(테스트 설계서)를 뜻합니다. 제출 필수 문서는 PRD와 TRD이며, TDD는 보조 문서입니다.

## 프로젝트 구조

```text
frontend/
  src/
    app/                         # 앱 진입점, 라우팅, 전역 상태
    pages/                       # 작업 목록, 등록·수정, 배치 제안 화면
    features/
      tasks/                     # 작업 등록과 상태 관리
      workers/                   # 일손 정보와 가능 일정
      matching/                  # 후보, 매칭 이유, 충돌 안내
      assignments/               # 제안, 수락, 거절, 확정 요청
    components/                  # 공통 UI
    lib/                         # API 클라이언트와 공통 함수
    types/                       # 프론트엔드 타입
  tests/                         # Playwright E2E 테스트
backend/
  app/
    api/routes/                  # FastAPI 라우트
    schemas/                     # API 입출력 검증 모델
    models/                      # 도메인 모델
    services/                    # 매칭, 배정, 데모 업무 규칙
    repositories/                # 저장소 인터페이스와 구현
    agent/                       # Agent Framework workflow와 도구
  tests/
    unit/                        # 업무 규칙 단위 테스트
    integration/                 # API 통합 테스트
infra/                           # Azure 배포 설정
```

매칭·충돌 판정과 배정 확정 검증은 백엔드의 결정적 업무 규칙으로 유지하며, 에이전트는 검증된 결과를 설명하는 역할만 담당합니다. 각 디렉터리의 `.gitkeep`은 구현 파일이 추가되기 전까지 구조를 Git에 보존합니다.
