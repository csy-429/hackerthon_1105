import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "../lib/api";
import { Chat } from "../components/Chat";
import { askPin, notifyDone } from "../lib/pin";
import { isUnread, workerInbox, useSeenTick } from "../lib/inbox";
import { ASSIGNMENT_STATUS_LABEL, TASK_STATUS_LABEL, fmt, parseSkills, withSeconds } from "../lib/format";
import type { AssignmentView, Demo, Opportunity, TimeWindow } from "../types";

interface Props {
  demo: Demo;
  workerId: string;
  onWorkerChange: (id: string) => void;
  /** 공유 링크로 들어왔을 때 강조할 작업 */
  focusTaskId?: string | null;
  onChanged: () => Promise<void>;
}

const PIN_PROMPT = "내 프로필 비밀번호 4자리를 입력하세요.";

export function WorkerPortalPage({ demo, workerId, onWorkerChange, focusTaskId, onChanged }: Props) {
  useSeenTick();
  const active = demo.workers;
  const setWorkerId = onWorkerChange;
  const worker = demo.workers.find((w) => w.id === workerId) ?? null;
  const inbox = workerInbox(demo.tasks, workerId);

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
  const [newWage, setNewWage] = useState("");
  const [newPin, setNewPin] = useState("");
  const [wage, setWage] = useState("");

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

  useEffect(() => {
    if (focusTaskId && opps.some((o) => o.task.id === focusTaskId)) {
      document.getElementById(`opp-${focusTaskId}`)?.scrollIntoView({ block: "center" });
    }
  }, [focusTaskId, opps.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
        pin: newPin,
        ...(newWage ? { desired_hourly_wage: Number(newWage) } : {}),
      });
      await onChanged();
      setWorkerId(w.id);
      setCreating(false);
      setNewName("");
      setNewExp("");
      setNewIntro("");
      setNewWage("");
      setNewPin("");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const applyTo = async (taskId: string, force: boolean) => {
    const pin = await askPin(PIN_PROMPT);
    if (!pin) return;
    setBusy(true);
    setError(null);
    try {
      await api.apply(taskId, workerId, pin, force);
      await onChanged();
      await loadAssignments();
      await loadOpps();
      notifyDone("지원이 완료되었습니다", "농장주가 선택하면 '받은 배치 요청'에 수락 상태로 표시됩니다. 조건이나 시급은 그곳의 채팅으로 협의할 수 있습니다.");
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
    setWage(worker?.desired_hourly_wage ? String(worker.desired_hourly_wage) : "");
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
    const pin = await askPin(PIN_PROMPT);
    if (!pin) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateWorker(
        worker.id,
        { skills: parseSkills(skills), availability: windows, ...(wage ? { desired_hourly_wage: Number(wage) } : {}) },
        pin,
      );
      await onChanged();
      setSaved(true);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!worker) return;
    const pin = await askPin(PIN_PROMPT);
    if (!pin) return;
    setError(null);
    try {
      await api.updateWorker(worker.id, { status: worker.status === "active" ? "inactive" : "active" }, pin);
      await onChanged();
    } catch (e) {
      setError(describeError(e));
    }
  };

  const respond = async (id: string, accept: boolean) => {
    const pin = await askPin(PIN_PROMPT);
    if (!pin) return;
    setBusy(true);
    setError(null);
    try {
      await (accept ? api.accept(id, pin) : api.decline(id, pin));
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
      <label>희망 시급 (원, 비우면 협의)</label>
      <input type="number" min={1} max={500000} step={100} value={newWage} onChange={(e) => setNewWage(e.target.value)} />
      <label>비밀번호 4자리 (스케줄 수정·활성/비활성·지원·수락 때 본인 확인에 사용합니다)</label>
      <input type="password" inputMode="numeric" maxLength={4} placeholder="숫자 4자리" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} />
      <div className="notice">연락처·주소·주민번호 등 개인정보는 입력하지 마세요. 전화번호·이메일 형식은 저장되지 않습니다.</div>
      <div className="row">
        <button className="primary" disabled={busy || !newName.trim() || newPin.length !== 4} onClick={() => void createProfile()}>프로필 만들기</button>
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
        <button onClick={() => void toggleStatus()}>
          {worker.status === "active" ? "비활성화" : "활성화"}
        </button>
      </div>
      <div className="muted">
        현재 상태: {worker.status === "active" ? "활동 중" : "비활성 (배치·지원 대상에서 빠집니다)"} · 희망 시급:{" "}
        {worker.desired_hourly_wage ? `${worker.desired_hourly_wage.toLocaleString()}원` : "협의"}
      </div>
      {creating && profileForm}
      {error && <div className="error">{error}</div>}

      <h3>내 할 일</h3>
      <div className={inbox.actions + inbox.unread > 0 ? "info" : "muted"}>
        {inbox.actions + inbox.unread > 0
          ? `응답이 필요한 배치 요청 ${inbox.actions}건 · 안 읽은 메시지 ${inbox.unread}건 (아래 '받은 배치 요청'을 확인하세요)`
          : "지금 처리할 항목이 없습니다. 푸시 알림은 없으니 가끔 이 화면을 확인하세요."}
      </div>

      <h3>모집 중인 작업</h3>
      {opps.length === 0 && <p className="muted">현재 공개 모집 중인 작업이 없습니다.</p>}
      {focusTaskId && !opps.some((o) => o.task.id === focusTaskId) && (
        <div className="info">공유받은 공고는 현재 모집 중이 아닙니다(마감·취소되었거나 공개 모집이 아닙니다).</div>
      )}
      {opps.map((o) => {
        const status = o.evaluation.assignment_status;
        return (
          <div className={`card ${o.task.id === focusTaskId ? "highlight" : ""}`} id={`opp-${o.task.id}`} key={o.task.id}>
            <div className="row">
              <strong className="grow">{o.task.title}</strong>
              {o.task.id === focusTaskId && <span className="badge new">공유받은 공고</span>}
              <span className="badge">남은 자리 {o.free_slots}명</span>
            </div>
            <div className="muted">
              {fmt(o.task.start_at)} ~ {fmt(o.task.end_at)} · 시급 {o.task.hourly_wage ? `${o.task.hourly_wage.toLocaleString()}원` : "협의"} · 조건: {o.task.required_skills.join(", ") || "없음"}
            </div>
            <ul>
              {o.evaluation.reasons.map((r) => <li key={r} className="ok">✔ {r}</li>)}
              {o.evaluation.warnings.map((r) => <li key={r} className="warn">⚠ {r}</li>)}
              {o.evaluation.exclusions.map((r) => <li key={r} className="bad">✖ {r}</li>)}
            </ul>
            {status ? (
              <span className="badge">{ASSIGNMENT_STATUS_LABEL[status]}</span>
            ) : o.evaluation.eligible ? (
              <button className="primary" disabled={busy} onClick={() => void applyTo(o.task.id, false)}>
                지원하기
              </button>
            ) : o.evaluation.requestable ? (
              <button
                disabled={busy}
                onClick={() => {
                  if (window.confirm("조건이 맞지 않지만 지원합니다. 농장주가 협의 후 선택할 수 있습니다. 계속할까요?")) void applyTo(o.task.id, true);
                }}
              >
                조건이 달라도 지원하기
              </button>
            ) : (
              <span className="muted">지원할 수 없습니다 (비활성·거절 이력·확정 일정 겹침 등)</span>
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
              {isUnread(a, "worker") && <span className="badge new">새 메시지</span>}
              {a.agreed_wage && <span className="badge">합의 시급 {a.agreed_wage.toLocaleString()}원</span>}
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
            {a.override_reasons.length > 0 && (
              <ul>{a.override_reasons.map((r) => <li key={r} className="warn">⚠ 조건 불일치: {r}</li>)}</ul>
            )}
            <Chat assignment={a} me="worker" onChanged={async () => { await onChanged(); await loadAssignments(); }} />
          </div>
        );
      })}

      <h3>내 스케줄</h3>
      <div className="card">
        <label>할 수 있는 작업 유형 (쉼표로 구분)</label>
        <input value={skills} onChange={(e) => setSkills(e.target.value)} />
        <label>희망 시급 (원, 비우면 협의)</label>
        <input type="number" min={1} max={500000} step={100} value={wage} onChange={(e) => setWage(e.target.value)} />
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
