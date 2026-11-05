import { TASK_STATUS_LABEL, fmt } from "../lib/format";
import type { Demo } from "../types";

interface Props {
  demo: Demo;
  taskId: string;
  onApply: () => void;
  onHome: () => void;
}

/** 공유 링크로 열리는 공개 공고 페이지. 지원자·배치 정보는 보여주지 않는다. */
export function JobPage({ demo, taskId, onApply, onHome }: Props) {
  const task = demo.tasks.find((t) => t.id === taskId);
  if (!task) {
    return (
      <>
        <h2>공고를 찾을 수 없습니다</h2>
        <p className="muted">삭제되었거나 서버가 초기화되어 사라진 공고일 수 있습니다. 보낸 분께 다시 확인해 주세요.</p>
        <button onClick={onHome}>처음으로</button>
      </>
    );
  }
  const farm = demo.farms.find((f) => f.id === task.farm_id);
  const free = task.required_workers - task.active_count;
  const recruiting = task.open_recruitment && (task.status === "draft" || task.status === "proposed");

  return (
    <>
      <h2>{task.title}</h2>
      <div className="card">
        <div className="row">
          {farm && <strong className="grow">{farm.name}</strong>}
          <span className={`badge ${task.status}`}>{recruiting ? "모집 중" : task.open_recruitment ? `마감 (${TASK_STATUS_LABEL[task.status]})` : "공개 모집 아님"}</span>
        </div>
        <ul>
          <li>일시: {fmt(task.start_at)} ~ {fmt(task.end_at)}</li>
          <li>시급: {task.hourly_wage ? `${task.hourly_wage.toLocaleString()}원` : "협의"}</li>
          <li>필요 작업 유형: {task.required_skills.join(", ") || "없음"}</li>
          <li>필요 인원 {task.required_workers}명 · 남은 자리 {Math.max(free, 0)}명</li>
        </ul>
        {task.description && <p>{task.description}</p>}
        {recruiting ? (
          <>
            <button className="primary" onClick={onApply}>일손으로 지원하러 가기</button>
            <p className="muted">
              일손 화면에서 내 프로필(닉네임)을 만들거나 선택해 지원합니다. 지원은 확정이 아니며, 농장주가 선택하고 확정해야 배치됩니다.
              조건·시급이 달라도 지원해 협의할 수 있습니다.
            </p>
          </>
        ) : (
          <p className="muted">현재 이 공고에는 지원할 수 없습니다.</p>
        )}
      </div>
      <button onClick={onHome}>처음으로</button>
    </>
  );
}
