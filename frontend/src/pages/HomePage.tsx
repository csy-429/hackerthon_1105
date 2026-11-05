import type { Role } from "../app/App";

interface Props {
  onSelect: (role: Role) => void;
  onGuide: () => void;
}

export function HomePage({ onSelect, onGuide }: Props) {
  return (
    <>
      <h2>농가의 일손과 작업 일정을 한곳에서</h2>
      <p className="muted">
        농장주는 작업을 등록하고 배치안을 검토해 확정하며, 일손은 가능한 시간을 등록하고 배치 요청을 수락합니다.
        일손이 수락하기 전에는 배치가 확정되지 않습니다.
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="primary" onClick={onGuide}>📖 처음이신가요? 사용 방법 보기</button>
      </div>
      <div className="row" style={{ alignItems: "stretch" }}>
        <button className="card grow role-card" onClick={() => onSelect("farmer")}>
          <h3>🌾 농장주로 시작</h3>
          <p>작업 등록·수정·취소, 후보 검토, 배치 요청과 확정</p>
        </button>
        <button className="card grow role-card" onClick={() => onSelect("worker")}>
          <h3>🧑‍🌾 일손으로 시작</h3>
          <p>내 스케줄 관리, 받은 배치 요청 수락·거절</p>
        </button>
      </div>
      <p className="muted">데모에서는 로그인 없이 역할만 선택합니다. 언제든 상단의 "역할 바꾸기"로 전환할 수 있습니다.</p>
    </>
  );
}
