import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "../lib/api";
import { ASSIGNMENT_STATUS_LABEL, TASK_STATUS_LABEL, fmt, parseSkills, withSeconds } from "../lib/format";
import type { AssignmentView, Demo, Opportunity, TimeWindow } from "../types";

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
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExp, setNewExp] = useState("");
  const [newIntro, setNewIntro] = useState("");

  const loadOpps = useCallback(async () => {
    if (!workerId) return setOpps([]);
    try {
      setOpps(await api.opportunities(workerId));
    } catch (e) {
      setError(describeError(e));
    }
  }, [workerId]);

  useEffect(() => {
    void loadOpps();
  }, [loadOpps, demo.tasks, demo.workers]);

  const createProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      const w = await api.createPublicWorker({
        display_name: newName,
        skills: [],
        availability: [],
        experience: newExp,
        intro: newIntro,
      });
      await onChanged();
      setWorkerId(w.id);
      setCreating(false);
      setNewName("");
      setNewExp("");
      setNewIntro("");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const applyTo = async (taskId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.apply(taskId, workerId);
      await onChanged();
      await loadAssignments();
      await loadOpps();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };
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

  const profileForm = (
    <div className="card">
      <label>닉네임 (실명 대신 사용하세요)</label>
      <input maxLength={40} value={newName} onChange={(e) => setNewName(e.target.value)} />
      <label>경력 (선택)</label>
      <input maxLength={200} value={newExp} onChange={(e) => setNewExp(e.target.value)} />
      <label>자기소개 (선택)</label>
      <textarea maxLength={500} value={newIntro} onChange={(e) => setNewIntro(e.target.value)} />
      <div className="notice">연락처·주소·주민번호 등 개인정보는 입력하지 마세요. 전화번호·이메일 형식은 저장되지 않습니다.</div>
      <div className="row">
        <button className="primary" disabled={busy || !newName.trim()} onClick={() => void createProfile()}>프로필 만들기</button>
        <button onClick={() => setCreating(false)}>닫기</button>
      </div>
      <p className="muted">만든 뒤 아래에서 작업 유형과 가능 시간을 등록하면 공개 모집 작업에 지원할 수 있습니다.</p>
    </div>
  );

  return (
    <>
      <h2>일손 화면</h2>
      <div className="notice">데모에서는 로그인 없이 일손을 선택해 본인 화면을 확인합니다.</div>
      <label>일손 선택</label>
      <div className="row">
        <select className="grow" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
          {active.map((w) => (
            <option key={w.id} value={w.id}>{w.display_name}{w.origin === "public" ? " (공개 프로필)" : ""}</option>
          ))}
        </select>
        <button onClick={() => setCreating((v) => !v)}>＋ 새 프로필 만들기</button>
      </div>
      {creating && profileForm}
      {error && <div className="error">{error}</div>}

      <h3>모집 중인 작업</h3>
      {opps.length === 0 && <p className="muted">현재 공개 모집 중인 작업이 없습니다.</p>}
      {opps.map((o) => {
        const status = o.evaluation.assignment_status;
        return (
          <div className="card" key={o.task.id}>
            <div className="row">
              <strong className="grow">{o.task.title}</strong>
              <span className="badge">남은 자리 {o.free_slots}명</span>
            </div>
            <div className="muted">
              {fmt(o.task.start_at)} ~ {fmt(o.task.end_at)} · 조건: {o.task.required_skills.join(", ") || "없음"}
            </div>
            <ul>
              {o.evaluation.reasons.map((r) => <li key={r} className="ok">✔ {r}</li>)}
              {o.evaluation.warnings.map((r) => <li key={r} className="warn">⚠ {r}</li>)}
              {o.evaluation.exclusions.map((r) => <li key={r} className="bad">✖ {r}</li>)}
            </ul>
            {status ? (
              <span className="badge">{ASSIGNMENT_STATUS_LABEL[status]}</span>
            ) : (
              <button className="primary" disabled={busy || !o.evaluation.eligible} onClick={() => void applyTo(o.task.id)}>
                지원하기
              </button>
            )}
          </div>
        );
      })}

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
            {a.status === "applied" && t && (t.status === "draft" || t.status === "proposed") && (
              <div className="row" style={{ marginTop: 8 }}>
                <span className="muted grow">지원했습니다. 농장주가 선택하면 수락 상태로 바뀝니다.</span>
                <button disabled={busy} onClick={() => void respond(a.id, false)}>지원 취소</button>
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
