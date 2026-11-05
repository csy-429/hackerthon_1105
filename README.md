# hackerthon_1105

청도 바이브코딩 해커톤 제출용 레포지토리입니다.

## 기획 문서

- [PRD.md](./PRD.md) — 제품 요구사항 및 MVP 범위
- [TRD.md](./TRD.md) — 기술 구조, 데이터 모델, API 초안
- [TDD.md](./TDD.md) — 테스트 설계 및 MVP 검증 기준

> TDD는 Test Design Document(테스트 설계서)를 뜻합니다. 제출 필수 문서는 PRD와 TRD이며, TDD는 보조 문서입니다.

## 실행 방법

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
cd frontend; npm install; npm run build; cd ..
.\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --port 8000   # http://localhost:8000
.\.venv\Scripts\python -m pytest                                               # 백엔드 테스트
```

개발 중 프론트엔드는 `cd frontend; npm run dev`(`/api`는 8000 포트로 프록시)로 실행합니다.
데이터는 서버 메모리에 두고 변경될 때마다 JSON 파일에 저장합니다. 파일이 없으면 데모 데이터가 자동으로 로드됩니다. 저장 위치는 `STATE_FILE` 환경 변수이고, Azure App Service에서는 기본값 `/home/data/ilsonitda-state.json`입니다. 로컬에서 `STATE_FILE`을 지정하지 않으면 저장하지 않습니다.
AI 배치 설명은 Microsoft Agent Framework의 GitHub Copilot provider를 사용합니다. 서버가 계산한 후보·일정 결과를 읽기 전용 도구로 제공하며, AI는 요약만 만듭니다. 후보 적격성 판정과 배치 확정은 계속 서버와 사용자가 담당합니다.

로컬에서는 인증된 Copilot CLI를 사용합니다. 먼저 `copilot login`으로 로그인한 뒤 앱을 실행하세요. Azure App Service에서는 CLI 로그인 상태가 공유되지 않으므로 앱 설정에 `COPILOT_GITHUB_TOKEN`을 비밀 값으로 등록해야 합니다. 토큰은 프론트엔드, 저장소, 채팅에 넣지 마세요. 설정이 없으면 `POST /api/agent/plan`은 성공을 가장하지 않고 503을 반환합니다. 토큰 발급은 GitHub의 [Copilot CLI 인증 안내](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli)를 참고하세요.

첫 화면에서 "농장주" 또는 "일손" 역할을 고릅니다. 이는 로그인이 아닌 화면 분기이며, 서버는 역할을 구분하지 않으므로 실제 서비스에는 인증·권한 검사가 필요합니다. 첫 화면의 "사용 방법 보기"에서 농장주·일손별 사용 순서를 일러스트와 함께 볼 수 있습니다.

농장주는 작업을 "공개 모집"으로 열 수 있고, 일손 화면에서 "새 프로필 만들기"로 닉네임 프로필을 만들어 지원할 수 있습니다. 지원자는 농장주가 선택·확정해야 배치됩니다. 작업과 일손은 만들 때 정한 숫자 4자리 비밀번호(PIN)로 수정·상태 변경·수락·확정 시 본인 확인을 합니다(데모 PIN은 `1234`, 5회 실패 시 5분 잠금, 신원 확인 아님). 시급·희망 시급을 입력할 수 있고 조건이 달라도(차단 사유 제외) 요청·지원할 수 있으며, 배치별 협의 채팅(5초 폴링, 푸시 알림 없음)에서 시급을 제안·수락해 합의할 수 있고, 화면 상단·카드에 '할 일'·새 메시지 배지(10초 갱신, 읽음 기록은 브라우저에만 저장)가 뜹니다. 공개 모집 공고는 공유 링크(`#/jobs/{id}`)로 볼 수 있고, 배치 요청·지원·시급 제안이 서버에 전달되면 '완료' 모달이 뜹니다. 신원 확인, 평점, 연락처 교환, 스팸 방지는 없으며 연락처 형식(전화번호·이메일) 입력은 서버가 거부합니다.

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
