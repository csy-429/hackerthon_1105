# TRD — 일손잇다

## 1. 시스템 개요

일손잇다는 반응형 웹 앱이다. 프론트엔드는 작업 등록과 일정 검토 UI를 제공하고, 백엔드는 일정·후보 계산과 AI 에이전트 실행을 담당한다.

### 제안 기술 스택

- Frontend: React + TypeScript
- Backend: Python 3.11+ / FastAPI
- Agent orchestration: Microsoft Agent Framework
- Model/runtime integration: GitHub Copilot SDK를 사용하는 Agent Framework GitHub Copilot provider
- 초기 저장소: SQLite 또는 데모용 저장소 추상화
- 배포: Azure Container Apps의 기본 도메인
- 테스트: pytest, HTTPX, Playwright

Microsoft Agent Framework의 GitHub Copilot 연동은 Python 패키지 `agent-framework-github-copilot`을 제공한다. 프로젝트 설정 시 공식 문서와 패키지 버전을 다시 확인한다.

참고:

- [Microsoft Agent Framework — GitHub Copilot package](https://github.com/microsoft/agent-framework/tree/main/python/packages/github_copilot)
- [GitHub Copilot SDK](https://github.com/github/copilot-sdk)

## 2. 구성 요소

### Frontend

- 작업 목록과 등록 폼
- 일손 가능 일정 및 작업 조건 화면
- 배치 제안, 매칭 이유, 충돌 경고 화면
- 작업자 수락·거절을 시연하는 데모 화면
- AI 처리 중 상태와 실패 메시지 표시

### Backend API

- 입력 검증 및 업무 규칙 적용
- 일정 충돌 검사와 후보 필터링
- Agent Framework workflow 실행
- 저장소 접근 및 데모 초기 데이터 제공
- AI가 반환한 초안을 검증한 뒤 UI에 전달

### Agent workflow

1. 요청과 앱 컨텍스트를 확인한다.
2. 작업 등록 또는 작업 조회 도구를 호출한다.
3. 결정적 일정 매칭 도구를 호출한다.
4. 구조화된 후보와 매칭 근거를 사용자 친화적으로 요약한다.
5. 일정 확정 같은 상태 변경은 사용자 승인 이후 별도 API로 처리한다.

모델이 직접 임의의 작업자나 일정을 만들어내지 않도록, 후보 목록과 확정 가능 여부는 도구 결과만 사용한다.

## 3. 데이터 모델

### Farm

- `id`
- `name`
- `region_label` — 데모용 지역 설명
- `created_at`

### Worker

- `id`
- `display_name` — 데모에서는 가명
- `skills` — 작업 유형 목록
- `availability` — 날짜 및 시간 구간
- `status`

### Task

- `id`
- `farm_id`
- `title`
- `description`
- `start_at`
- `end_at`
- `required_workers`
- `required_skills`
- `status` — draft, proposed, confirmed, completed, cancelled

### Assignment

- `id`
- `task_id`
- `worker_id`
- `status` — proposed, accepted, declined, confirmed
- `match_reasons`
- `created_at`

핵심 데이터는 최소화한다. MVP에서는 연락처, 상세 주소, 주민등록 정보, 임금·계좌 정보 등을 저장하지 않는다.

## 4. 매칭 및 충돌 판정

매칭 후보는 다음 규칙을 모두 통과해야 한다.

- 작업 시간과 일손의 가능 시간이 겹친다.
- 같은 시간에 이미 확정된 작업이 없다.
- 작업에 필요한 기술 조건이 등록되어 있다.
- 작업 상태가 취소되지 않았다.

후보 점수는 단순하고 설명 가능하게 유지한다. 예를 들어 가능 시간 일치와 기술 일치를 기준으로 정렬한다. 점수는 추천 순서일 뿐 고용 적합성이나 작업자의 우열을 의미하지 않는다.

매칭 결과는 `candidate_id`, `eligible`, `reasons`, `warnings` 구조로 반환한다. AI는 이 결과를 설명할 수 있지만 `eligible` 값을 변경할 수 없다.

## 5. API 초안

- `GET /api/demo` — 데모 초기 데이터 및 사용 안내
- `GET /api/tasks` — 작업 목록
- `POST /api/tasks` — 작업 초안 생성
- `PATCH /api/tasks/{id}` — 작업 정보 수정
- `POST /api/tasks/{id}/suggestions` — 후보 및 배치안 계산
- `POST /api/assignments/{id}/accept` — 일손 수락
- `POST /api/assignments/{id}/decline` — 일손 거절
- `POST /api/tasks/{id}/confirm` — 조건 충족 및 사용자 확인 후 확정
- `POST /api/agent/plan` — 에이전트가 작업 요청을 구조화하고 배치안을 설명
- `GET /health` — 상태 확인

모든 입력은 서버에서 검증한다. 클라이언트가 보낸 `confirmed` 상태를 그대로 신뢰하지 않는다.

## 6. Azure 배포와 운영

- 웹 앱과 API를 하나의 컨테이너로 배포해 해커톤 MVP의 운영 구성을 단순화한다.
- Azure Container Apps 기본 도메인을 사용한다.
- `/health`를 컨테이너 상태 점검 경로로 제공한다.
- 로그에는 요청 ID, 처리 단계, 오류 유형을 기록하되 개인정보나 프롬프트의 민감한 내용은 남기지 않는다.
- 비밀 설정은 Azure Container Apps secrets 또는 이에 준하는 안전한 환경 설정에 둔다.
- 컨테이너 재시작 시 데모 데이터를 다시 초기화할 수 있도록 한다.
- MVP 저장소의 영속성 한계와 데모 초기화 방법을 화면 또는 문서에 명시한다.

## 7. 보안 및 신뢰

- 데모 환경에는 실제 개인 정보를 입력하지 않도록 안내한다.
- 브라우저에서 Copilot SDK 자격 증명을 사용하지 않는다.
- AI가 만든 일정안은 항상 초안으로 표시한다.
- 확정 API는 일정 충돌과 당사자 동의 상태를 서버에서 다시 확인한다.
- 프롬프트에 포함된 사용자 입력은 지시가 아니라 데이터로 취급한다.
- 도구는 필요한 업무 함수만 허용하고 임의의 코드 실행, 파일 접근, 외부 시스템 조작을 허용하지 않는다.
- AI 호출 실패 시 성공처럼 보이는 기본 결과를 반환하지 않고, 오류와 재시도 방법을 표시한다.

## 8. 주요 기술 리스크

- GitHub Copilot SDK 기반 에이전트가 Azure Container Apps 런타임에서 인증·실행 가능한지 조기에 검증한다. 로컬 개발자 인증이 배포 환경에 자동으로 적용된다고 가정하지 않는다.
- Agent Framework와 Copilot provider의 버전 및 API 변경에 대비해 의존성 버전을 고정한다.
- 모델 응답은 스키마 검증 후에만 UI에 전달한다.
- AI 호출이 실패해도 결정적 후보 필터링과 충돌 검사는 동작하도록 분리한다.
