import { useState } from "react";
import type { Role } from "../app/App";
import { Illustration, type IllustrationName } from "../components/Illustration";

interface Step {
  title: string;
  desc: string;
  where: string;
  art: IllustrationName;
}

interface Guide {
  label: string;
  intro: string;
  steps: Step[];
  rules: string[];
}

const GUIDES: Record<Role, Guide> = {
  farmer: {
    label: "농장주",
    intro: "작업을 올리고, 맞는 일손을 골라 확정하기까지 5단계입니다.",
    steps: [
      {
        title: "작업 등록",
        desc: "작업명, 날짜·시간, 시급, 필요 인원, 필요한 작업 유형, 본인 확인용 비밀번호 4자리를 입력합니다. 일손이 부족하면 '공개 모집'을 켜 처음 보는 일손의 지원도 받을 수 있습니다.",
        where: "작업·일정 → 작업 등록",
        art: "task",
      },
      {
        title: "일손 명단 관리",
        desc: "이미 아는 일손은 명단에 등록해 둡니다. 명단 일손은 모든 작업의 후보로 자동 검토됩니다.",
        where: "일손 목록",
        art: "roster",
      },
      {
        title: "후보 검토",
        desc: "‘배치 검토’에서 후보별 매칭 이유, 주의할 점, 제외 사유와 충돌한 일정을 확인합니다. 공개 지원자는 경력·소개도 함께 보입니다.",
        where: "작업 카드 → 배치 검토",
        art: "review",
      },
      {
        title: "배치 요청·지원자 선택",
        desc: "원하는 일손을 골라 요청합니다(비밀번호 확인). 조건이 맞지 않는 일손도 협의를 위해 요청할 수 있고, 협의는 배치 카드의 채팅에서 합니다. 지원자는 선택하면 바로 수락 상태가 됩니다.",
        where: "후보 검토 → 배치 요청",
        art: "request",
      },
      {
        title: "확정",
        desc: "필요 인원이 모두 수락하면 승인 체크 후 확정합니다. 확정 직전에 서버가 일정 충돌을 다시 확인합니다.",
        where: "배치 현황 → 배치 확정",
        art: "confirm",
      },
    ],
    rules: [
      "일손이 수락하기 전에는 확정되지 않습니다.",
      "확정되면 남은 지원은 자동으로 마감됩니다.",
      "작업을 취소하거나 일정·조건을 바꾸면 기존 배치 요청은 다시 받아야 합니다.",
    ],
  },
  worker: {
    label: "일손",
    intro: "스케줄을 등록하고, 맞는 작업에 지원하거나 요청을 수락하기까지 4단계입니다.",
    steps: [
      {
        title: "내 프로필 선택·만들기",
        desc: "농장주가 등록해 준 일손이면 목록에서 본인을 고르고, 처음이라면 '새 프로필 만들기'로 닉네임·희망 시급·비밀번호 4자리를 정합니다.",
        where: "일손 화면 → 일손 선택 / 새 프로필 만들기",
        art: "profile",
      },
      {
        title: "스케줄 등록",
        desc: "할 수 있는 작업 유형과 가능한 날짜·시간대를 등록하고 저장합니다. 이 정보로 작업과 맞는지 자동 확인됩니다.",
        where: "일손 화면 → 내 스케줄",
        art: "schedule",
      },
      {
        title: "작업 찾기·지원",
        desc: "모집 중인 작업의 시급과 맞는·맞지 않는 이유를 확인하고 '지원하기'를 누릅니다. 조건이 달라도 협의를 위해 지원할 수 있습니다. 스케줄 수정·활성/비활성은 비밀번호로 본인 확인합니다.",
        where: "일손 화면 → 모집 중인 작업",
        art: "apply",
      },
      {
        title: "요청 수락·확정 확인",
        desc: "농장주가 보낸 배치 요청을 수락하거나 거절합니다. 농장주가 최종 확정하면 ‘확정’으로 바뀝니다.",
        where: "일손 화면 → 받은 배치 요청",
        art: "inbox",
      },
    ],
    rules: [
      "수락하기 전에는 일정이 확정되지 않습니다.",
      "지원했다고 바로 배치되지 않으며, 농장주가 선택해야 합니다.",
      "이미 확정된 다른 작업과 시간이 겹치면 지원할 수 없습니다.",
    ],
  },
};

const COMMON_NOTES = [
  "로그인 없이 역할만 골라 체험하는 데모입니다. 실제 개인정보를 입력하지 마세요. 데모 데이터의 비밀번호는 모두 1234입니다.",
  "비밀번호 4자리는 본인 확인용 약한 장치이며 신원 확인이 아닙니다. 연락처는 입력할 수 없고, 평점·알림 기능은 없습니다. 협의 채팅만 지원합니다.",
  "데이터는 서버 메모리에만 저장되며 ‘데모 데이터 불러오기’로 초기화됩니다.",
];

interface Props {
  onStart: (role: Role) => void;
  onBack: () => void;
}

export function GuidePage({ onStart, onBack }: Props) {
  const [tab, setTab] = useState<Role>("farmer");
  const guide = GUIDES[tab];

  return (
    <>
      <button onClick={onBack}>← 처음으로</button>
      <h2>사용 방법</h2>
      <p className="muted">농장주와 일손이 각자 어떤 순서로 쓰는지 한눈에 확인하세요.</p>

      <div className="row guide-tabs" role="tablist">
        {(Object.keys(GUIDES) as Role[]).map((r) => (
          <button key={r} role="tab" aria-selected={tab === r} className={tab === r ? "primary" : ""} onClick={() => setTab(r)}>
            {GUIDES[r].label}
          </button>
        ))}
      </div>

      <p>{guide.intro}</p>

      <ol className="steps">
        {guide.steps.map((s, i) => (
          <li className="card step" key={s.title}>
            <span className="step-no">{i + 1}</span>
            <Illustration name={s.art} />
            <div className="grow">
              <strong>{s.title}</strong>
              <p>{s.desc}</p>
              <span className="badge">{s.where}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="card rules">
        <strong>꼭 알아두세요</strong>
        <ul>{guide.rules.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <button className="primary" onClick={() => onStart(tab)}>
          {tab === "farmer" ? "농장주로 시작하기" : "일손으로 시작하기"}
        </button>
      </div>

      <div className="notice">
        <strong>데모 안내</strong>
        <ul>{COMMON_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
      </div>
    </>
  );
}
