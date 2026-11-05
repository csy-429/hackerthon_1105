# TRD — 일손잇다

## 1. 시스템 개요

일손잇다는 반응형 웹 앱이다. 프론트엔드는 작업 등록과 일정 검토 UI를 제공하고, 백엔드는 일정·후보 계산과 AI 에이전트 실행을 담당한다.

### 제안 기술 스택

- Frontend: React + TypeScript
- Backend: Python 3.11+ / FastAPI
- Agent orchestration: Microsoft Agent Framework
- Model/runtime integration: GitHub Copilot SDK를 사용하는 Agent Framework GitHub Copilot provider
- 초기 저장소: SQLite 또는 데모용 저장소 추상화
- 배포: Azure App Service Linux (현재 공개 데모는 F1 요금제)
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

`POST /api/agent/plan`은 먼저 서버의 결정적 매칭 함수를 실행하고, 확정된 작업·후보·경고·제외 사유를 읽기 전용 `get_verified_matching_result` 도구로 Agent Framework GitHub Copilot 에이전트에 제공한다. 에이전트는 한국어 설명 초안만 반환한다. 일정 확정이나 후보 판정 권한은 갖지 않으며, 최종 응답의 구조화된 후보 정보는 서버의 매칭 결과 그대로다. AI 응답에서 빈 설명이나 잘못된 후보 참조가 발견되면 오류로 처리한다.

로컬 개발은 로그인된 Copilot CLI를 사용한다. Azure에서는 `COPILOT_GITHUB_TOKEN`을 App Service 애플리케이션 설정(비밀 값)으로 제공해야 한다. 배포 환경에 토큰이 없으면 에이전트를 비활성화하고 API는 재시도 가능한 503을 반환한다. 토큰을 브라우저나 저장소에 노출하지 않는다.

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
- `origin` — roster(농장주 명단) 또는 public(공개 지원)
- `experience`, `intro` — 선택 입력(200자·500자), 연락처 형식 거부
- `desired_hourly_wage` — 희망 시급(원, 선택)

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
- `open_recruitment` — 공개 모집 여부(기본 false)
- `hourly_wage` — 시급(원, 선택)

### Assignment

- `id`
- `task_id`
- `worker_id`
- `status` — proposed, accepted, declined, confirmed 외에 `applied`(공개 모집 지원, 인원 미차지)
- `match_reasons`
- `override_reasons` — 조건이 맞지 않는데도 요청·지원한 경우 당사자가 인지한 사유
- `created_at`

### Message

- `id`, `assignment_id`, `sender`(farmer|worker), `text`(1~500자, 연락처 형식 거부), `created_at`
- 배치 1건당 최대 200개. 거절(`declined`)된 배치에는 보낼 수 없다.
- `kind`가 `wage_offer`/`wage_accept`이면 시급 제안·합의 기록이며 `wage`를 가진다.
- `Assignment`의 `offer_wage`/`offer_by`는 대기 중인 제안, `agreed_wage`는 합의 시급이다. 배치 응답에는 안 읽은 표시용 `message_count`, `last_message_sender`, `last_message_at`만 포함하고 메시지 내용은 넣지 않는다(읽음 여부는 클라이언트가 브라우저에 기록).
- `POST /api/assignments/{id}/wage-offer`(양 당사자 PIN, 새 제안이 이전 제안을 대체), `POST /api/assignments/{id}/wage-offer/accept`(제안자의 상대 PIN만 가능, 본인 제안 수락은 409)
- 공유 링크는 클라이언트 해시 경로 `#/jobs/{task_id}`이며 `GET /api/demo` 데이터로 그린다.

### 비밀번호(PIN)

- 작업과 일손을 만들 때 숫자 4자리 `pin`을 받는다(`^\d{4}$`). 도메인 모델과 응답에는 포함하지 않고 별도 저장소(`pins`)에 PBKDF2-SHA256 + 솔트 해시로만 둔다.
- 이후 보호된 요청은 `X-Pin` 헤더로 보낸다. 없으면 401 `pin_required`, 틀리면 403 `invalid_pin`, 5회 연속 실패 시 5분간 429 `pin_locked`. 비교는 상수 시간 비교를 쓴다.
- 한계: 조합이 1만 개라 무차별 대입에 약하고(잠금으로만 완화), 분실 복구와 신원 확인이 없다. 서버 메모리 저장이라 재시작 시 사라진다.

| 요청 | 필요한 PIN |
|---|---|
| 작업 수정·취소·배치 요청·확정 | 작업 PIN |
| 일손 수정(스케줄·상태) | 일손 PIN |
| 지원(`apply`), 수락(`accept`) | 일손 PIN |
| 거절(`decline`) | 일손 PIN 또는 작업 PIN |
| 메시지 조회·전송 | 일손 PIN 또는 작업 PIN(일치한 쪽이 발신자) |
| 후보 계산, 목록 조회, 데모 | 없음 |

핵심 데이터는 최소화한다. MVP에서는 연락처, 상세 주소, 주민등록 정보, 임금·계좌 정보 등을 저장하지 않는다.

## 4. 매칭 및 충돌 판정

매칭 후보는 다음 규칙을 모두 통과해야 한다.

- 일손이 활동 상태(`active`)이다.
- 일손의 가능 시간(여러 구간은 병합)이 작업 시간 전체를 완전히 포함한다. 일부만 겹치면 제외한다.
- 같은 시간에 이미 확정된 다른 작업이 없다. 시작·종료 시각이 맞닿는 경우는 충돌이 아니다.
- 작업에 필요한 기술(작업 유형)을 모두 갖추고 있다.
- 같은 작업에서 이미 거절한 일손이 아니다.
- 작업 상태가 취소되지 않았다.

후보 풀: `origin=roster` 일손은 항상 후보가 되고, `origin=public` 일손은 해당 작업에 지원(또는 배치)한 경우에만 후보가 된다. 지원(`applied`)은 인원을 차지하지 않으며, 농장주가 선택하면 서버가 같은 규칙으로 다시 검증한 뒤 수락(`accepted`) 상태로 바꾼다. 확정 시 남은 `applied`는 `declined`(마감)로 바뀐다. 작업의 일정·조건이 바뀌면 활성 배치만 폐기하고 지원은 유지한다(선택 시 재검증).

다른 작업에 제안(proposed)·수락(accepted) 상태로 겹치는 경우는 제외하지 않고 경고(`warnings`)로 표시한다.

시급: 일손의 희망 시급이 작업 시급보다 높으면 제외하지 않고 '협의 필요' 경고만 낸다. 한쪽이라도 비어 있으면 비교하지 않는다. 최저임금 등 법적 판단은 하지 않는다.

조건 불일치 요청: 제외 사유를 **차단 사유**(`blockers`: 취소된 작업, 비활성 일손, 이 작업 거절 이력, 확정된 다른 작업과 시간 겹침)와 **협의 가능 사유**(작업 유형 부족, 가능 시간 일부·불일치)로 나눈다. 차단 사유가 없으면 `requestable=true`이며, `request-confirmation`의 `force_worker_ids` 또는 `apply`의 `force=true`로 요청·지원할 수 있다. 이때 사유는 `Assignment.override_reasons`에 기록하고, 확정 시 재검증은 차단 사유만 확인한다.

후보 점수는 단순하고 설명 가능하게 유지한다. 적격 후보는 100점에서 경고 1건당 10점을 감점하고, 부적격 후보는 0점이다. 점수는 추천 순서일 뿐 고용 적합성이나 작업자의 우열을 의미하지 않는다.

매칭 결과는 다음 구조로 반환한다.

- `candidate_id`, `display_name`, `eligible`, `score`
- `reasons`: 적격 근거
- `warnings`: 제외하지는 않지만 확인이 필요한 사항
- `exclusions`: 부적격 사유(`eligible=false`일 때 사용자에게 표시)
- `blockers`, `requestable`: 요청으로도 넘길 수 없는 사유와, 조건 불일치 요청 가능 여부
- `desired_hourly_wage`: 일손의 희망 시급
- `conflicts`: 충돌한 일정(`task_id`, `title`, `start_at`, `end_at`)
- `assignment_status`: 이 작업에 이미 배치 요청이 있으면 그 상태
- `origin`, `experience`, `intro`: 일손 출처와 공개 프로필 정보

전체 응답에는 `shortage`(부족 인원)와 `shortage_reason`이 포함된다. AI는 이 결과를 설명할 수 있지만 `eligible`, `exclusions` 등 판정 값을 변경할 수 없다.

## 5. API 초안

- `GET /api/demo` — 데모 초기 데이터 및 사용 안내
- `GET /api/tasks` — 작업 목록
- `POST /api/tasks` — 작업 초안 생성
- `PATCH /api/tasks/{id}` — 작업 정보 수정
- `POST /api/tasks/{id}/suggestions` — 후보 및 배치안 계산
- `POST /api/tasks/{id}/apply` — 일손의 공개 모집 지원(`open_recruitment` 작업, 초안·제안 상태만, 일손 PIN). 조건 불충족이면 409와 `exclusions`·`blockers`, `force=true`면 차단 사유 없는 불일치 지원 가능
- `GET /api/workers/{id}/opportunities` — 공개 모집 중인 작업과 해당 일손의 적격 평가
- `POST /api/workers?public=true` — 공개 프로필(`origin=public`) 생성. 기본은 명단 일손(`roster`). 본문에 `pin` 필수
- `PATCH /api/workers/{id}` — 일손 수정(일손 PIN)
- `POST /api/tasks/{id}/request-confirmation` — 명단 일손에게 배치 요청(작업 PIN), 지원자는 선택 시 바로 수락 상태. `force_worker_ids`로 조건 불일치 요청
- `POST /api/assignments/{id}/accept` — 일손 수락(일손 PIN)
- `POST /api/assignments/{id}/decline` — 거절(일손 또는 작업 PIN). 지원(`applied`)은 지원 취소·지원 거절로 사용
- `GET|POST /api/assignments/{id}/messages` — 협의 채팅 조회·전송(일손 또는 작업 PIN)
- `POST /api/tasks/{id}/confirm` — 조건 충족 및 사용자 확인 후 확정(작업 PIN)
- `POST /api/agent/plan` — 에이전트가 작업 요청을 구조화하고 배치안을 설명
- `GET /health` — 상태 확인

모든 입력은 서버에서 검증한다. 클라이언트가 보낸 `confirmed` 상태를 그대로 신뢰하지 않는다.

## 6. Azure 배포와 운영

- 현재 데모는 Azure App Service Linux에 프론트엔드 빌드 결과와 FastAPI를 함께 배포한다. 공개 기본 도메인에서 로그인 없이 접속할 수 있다.
- `requirements.txt`는 App Service 원격 빌드의 Python 의존성 목록이다. `Dockerfile`은 컨테이너 배포용 대안이며 현재 App Service 배포 경로에는 사용되지 않는다.
- `/health`를 상태 점검 경로로 제공한다.
- 로그에는 요청 ID, 처리 단계, 오류 유형을 기록하되 개인정보나 프롬프트의 민감한 내용은 남기지 않는다.
- 비밀 설정은 App Service의 애플리케이션 설정에 둔다. `COPILOT_GITHUB_TOKEN` 값은 마스킹된 비밀로 관리하고 배포 산출물이나 Git에 포함하지 않는다.
- F1 요금제의 사용량·자원 한도와 Copilot 사용 권한/요금은 공개 데모 전 확인한다.
- 프로세스 재시작 시 데모 데이터를 다시 초기화할 수 있도록 한다.
- MVP 저장소의 영속성 한계와 데모 초기화 방법을 화면 또는 문서에 명시한다.

## 7. 보안 및 신뢰

- 데모 환경에는 실제 개인 정보를 입력하지 않도록 안내한다.
- 공개 지원자 프로필의 `experience`·`intro`와 채팅 메시지는 전화번호·이메일 형식을 서버에서 거부(422)하고 길이를 제한한다. 비밀번호 4자리는 계정이 아니라 본인 확인용이며 잠금으로만 대입을 늦춘다. 스팸 지원은 완전히 막지 못하며, 알려진 한계다.
- 브라우저에서 Copilot SDK 자격 증명을 사용하지 않는다.
- AI가 만든 일정안은 항상 초안으로 표시한다.
- 확정 API는 일정 충돌과 당사자 동의 상태를 서버에서 다시 확인한다.
- 프롬프트에 포함된 사용자 입력은 지시가 아니라 데이터로 취급한다.
- 도구는 필요한 업무 함수만 허용하고 임의의 코드 실행, 파일 접근, 외부 시스템 조작을 허용하지 않는다.
- AI 호출 실패 시 성공처럼 보이는 기본 결과를 반환하지 않고, 오류와 재시도 방법을 표시한다.

## 8. 주요 기술 리스크

- GitHub Copilot SDK 기반 에이전트가 Azure App Service 런타임에서 인증·실행 가능한지 배포 후 검증한다. 로컬 개발자 인증이 배포 환경에 자동으로 적용된다고 가정하지 않는다.
- Agent Framework와 Copilot provider의 버전 및 API 변경에 대비해 의존성 버전을 고정한다.
- 모델 응답은 스키마 검증 후에만 UI에 전달한다.
- AI 호출이 실패해도 결정적 후보 필터링과 충돌 검사는 동작하도록 분리한다.
