import { useState } from "react";
import { api, describeError } from "../lib/api";
import { fmt, parseSkills, withSeconds } from "../lib/format";
import type { TimeWindow, Worker } from "../types";

interface Props {
  workers: Worker[];
  onChanged: () => Promise<void>;
}

export function WorkersPage({ workers, onChanged }: Props) {
  const [name, setName] = useState("");
  const [skills, setSkills] = useState("");
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addWindow = () => {
    if (!start || !end) return setError("가능한 시작·종료 시각을 모두 입력하세요");
    if (end <= start) return setError("종료 시각은 시작 시각보다 늦어야 합니다");
    setError(null);
    setWindows((w) => [...w, { start: withSeconds(start), end: withSeconds(end) }]);
    setStart("");
    setEnd("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createWorker({ display_name: name, skills: parseSkills(skills), availability: windows });
      setName("");
      setSkills("");
      setWindows([]);
      await onChanged();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (w: Worker) => {
    setError(null);
    try {
      await api.updateWorker(w.id, { status: w.status === "active" ? "inactive" : "active" });
      await onChanged();
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <>
      <h2>일손 목록</h2>
      {error && <div className="error">{error}</div>}
      {workers.map((w) => (
        <div className="card" key={w.id}>
          <div className="row">
            <strong className="grow">{w.display_name}</strong>
            <span className="badge">{w.status === "active" ? "활동 중" : "비활성"}</span>
            <button onClick={() => void toggle(w)}>{w.status === "active" ? "비활성화" : "활성화"}</button>
          </div>
          <div className="muted">할 수 있는 작업: {w.skills.join(", ") || "없음"}</div>
          <div className="muted">
            가능 시간: {w.availability.map((a) => `${fmt(a.start)}~${fmt(a.end)}`).join(" / ") || "없음"}
          </div>
        </div>
      ))}

      <h2>일손 등록</h2>
      <form className="card" onSubmit={(e) => void submit(e)}>
        <label>표시 이름 (실명 대신 가명을 권장합니다)</label>
        <input required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
        <label>할 수 있는 작업 유형 (쉼표로 구분)</label>
        <input value={skills} placeholder="수확, 운반" onChange={(e) => setSkills(e.target.value)} />
        <label>가능한 날짜·시간</label>
        <div className="row">
          <input type="datetime-local" className="grow" value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="datetime-local" className="grow" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button type="button" onClick={addWindow}>시간대 추가</button>
        </div>
        <ul>
          {windows.map((w, i) => (
            <li key={i}>
              {fmt(w.start)} ~ {fmt(w.end)}{" "}
              <button type="button" onClick={() => setWindows((all) => all.filter((_, j) => j !== i))}>삭제</button>
            </li>
          ))}
        </ul>
        <button className="primary" disabled={busy}>일손 등록</button>
      </form>
    </>
  );
}
