import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "../lib/api";
import { ASSIGNMENT_STATUS_LABEL, TASK_STATUS_LABEL, fmt, parseSkills, withSeconds } from "../lib/format";
import type { AssignmentView, Demo, TimeWindow } from "../types";

interface Props {
  demo: Demo;
  onChanged: () => Promise<void>;
}

export function WorkerPortalPage({ demo, onChanged }: Props) {
  const active = demo.workers.filter((w) => w.status === "active");
  const [workerId, setWorkerId] = useState(active[0]?.id ?? "");
  const worker = demo.workers.find((w) => w.id === workerId) ?? null;

  const [skills, setSkills] = useState("");
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [assignments, setAssignments] = useState<AssignmentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadAssignments = useCallback(async () => {
    if (!workerId) return;
    try {
      setAssignments(await api.workerAssignments(workerId));
    } catch (e) {
      setError(describeError(e));
    }
  }, [workerId]);

  useEffect(() => {
    setSkills(worker?.skills.join(", ") ?? "");
    setWindows(worker?.availability ?? []);
    setSaved(false);
    setError(null);
  }, [workerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments, demo.tasks]);

  const addWindow = () => {
    if (!start || !end) return setError("시작·종료 시각을 모두 입력하세요");
    if (end <= start) return setError("종료 시각은 시작 시각보다 늦어야 합니다");
    setError(null);
    setWindows((w) => [...w, { start: withSeconds(start), end: withSeconds(end) }]);
    setStart("");
    setEnd("");
  };

  const save = async () => {
    if (!worker) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateWorker(worker.id, { skills: parseSkills(skills), availability: windows });
      await onChanged();
      setSaved(true);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const respond = async (id: string, accept: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await (accept ? api.accept(id) : api.decline(id));
      await onChanged();
      await loadAssignments();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!worker) return <p className="muted">활동 중인 일손이 없습니다. '일손' 탭에서 먼저 등록하세요.</p>;

  const taskOf = (id: string) => demo.tasks.find((t) => t.id === id);

  return (
    <>
      <h2>일손 화면</h2>
      <div className="notice">데모에서는 로그인 없이 일손을 선택해 본인 화면을 확인합니다.</div>
      <label>일손 선택</label>
      <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
        {active.map((w) => (
          <option key={w.id} value={w.id}>{w.display_name}</option>
        ))}
      </select>
      {error && <div className="error">{error}</div>}

      <h3>받은 배치 요청</h3>
      {assignments.length === 0 && <p className="muted">받은 배치 요청이 없습니다.</p>}
      {assignments.map((a) => {
        const t = taskOf(a.task_id);
        const canRespond = t?.status === "proposed" && (a.status === "proposed" || a.status === "accepted");
        return (
          <div className="card" key={a.id}>
            <div className="row">
              <strong className="grow">{t?.title ?? a.task_id}</strong>
              <span className="badge">{ASSIGNMENT_STATUS_LABEL[a.status]}</span>
            </div>
            {t && (
              <div className="muted">
                {fmt(t.start_at)} ~ {fmt(t.end_at)} · 작업 상태: {TASK_STATUS_LABEL[t.status]}
              </div>
            )}
            {canRespond && (
              <div className="row" style={{ marginTop: 8 }}>
                {a.status === "proposed" && (
                  <button className="primary" disabled={busy} onClick={() => void respond(a.id, true)}>수락</button>
                )}
                <button disabled={busy} onClick={() => void respond(a.id, false)}>거절</button>
              </div>
            )}
            {a.status === "accepted" && <div className="muted">수락했습니다. 농장주가 확정하면 확정으로 바뀝니다.</div>}
          </div>
        );
      })}

      <h3>내 스케줄</h3>
      <div className="card">
        <label>할 수 있는 작업 유형 (쉼표로 구분)</label>
        <input value={skills} onChange={(e) => setSkills(e.target.value)} />
        <label>가능한 날짜·시간</label>
        <ul>
          {windows.map((w, i) => (
            <li key={i}>
              {fmt(w.start)} ~ {fmt(w.end)}{" "}
              <button type="button" onClick={() => setWindows((all) => all.filter((_, j) => j !== i))}>삭제</button>
            </li>
          ))}
          {windows.length === 0 && <li className="muted">등록된 시간대가 없습니다</li>}
        </ul>
        <div className="row">
          <input type="datetime-local" className="grow" value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="datetime-local" className="grow" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button type="button" onClick={addWindow}>시간대 추가</button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" disabled={busy} onClick={() => void save()}>스케줄 저장</button>
          {saved && <span className="ok">저장했습니다</span>}
        </div>
        <p className="muted">이미 확정된 작업은 스케줄을 바꿔도 자동으로 취소되지 않습니다.</p>
      </div>
    </>
  );
}
