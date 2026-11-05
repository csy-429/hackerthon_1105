import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "../lib/api";
import { ASSIGNMENT_STATUS_LABEL, TASK_STATUS_LABEL, fmt } from "../lib/format";
import type { AgentPlan, Candidate, Demo, Suggestions, Task } from "../types";

interface Props {
  task: Task;
  demo: Demo;
  onChanged: () => Promise<void>;
  onBack: () => void;
}

type AiState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; plan: AgentPlan };

export function TaskDetailPage({ task, onChanged, onBack }: Props) {
  const [sug, setSug] = useState<Suggestions | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<AiState>({ phase: "idle" });

  const loadSuggestions = useCallback(async () => {
    try {
      setSug(await api.suggestions(task.id));
    } catch (e) {
      setError(describeError(e));
    }
  }, [task.id]);

  useEffect(() => {
    setPicked([]);
    void loadSuggestions();
  }, [loadSuggestions, task.status, task.assignments.length]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
      await loadSuggestions();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const askAi = async () => {
    setAi({ phase: "loading" });
    try {
      setAi({ phase: "done", plan: await api.plan(task.id, "이 작업의 후보 배치를 설명해 주세요") });
    } catch (e) {
      setAi({ phase: "error", message: describeError(e) });
    }
  };

  const open = task.status === "draft" || task.status === "proposed";
  const slots = task.required_workers - task.active_count;
  const toggle = (c: Candidate) =>
    setPicked((p) => (p.includes(c.candidate_id) ? p.filter((x) => x !== c.candidate_id) : [...p, c.candidate_id]));

  return (
    <>
      <button onClick={onBack}>← 목록</button>
      <h2>{task.title}</h2>
      <div className="muted">
        {fmt(task.start_at)} ~ {fmt(task.end_at)} · 필요 {task.required_workers}명 · 조건: {task.required_skills.join(", ") || "없음"}
      </div>
      <p>
        상태: <span className={`badge ${task.status}`}>{TASK_STATUS_LABEL[task.status]}</span>{" "}
        {task.status !== "confirmed" && <span className="muted">※ 일손이 모두 수락하고 농장주가 승인해야 확정됩니다.</span>}
      </p>
      {error && <div className="error">{error}</div>}

      <h3>배치 현황</h3>
      {task.assignments.length === 0 && <p className="muted">아직 배치 요청이 없습니다.</p>}
      {task.assignments.map((a) => (
        <div className="card" key={a.id}>
          <div className="row">
            <strong className="grow">{a.worker_name}</strong>
            <span className="badge">{ASSIGNMENT_STATUS_LABEL[a.status]}</span>
          </div>
          <ul>{a.match_reasons.map((r) => <li key={r} className="ok">{r}</li>)}</ul>
        </div>
      ))}

      {task.status === "proposed" && (
        <div className="card">
          <label>
            <input type="checkbox" style={{ width: "auto" }} checked={approved} onChange={(e) => setApproved(e.target.checked)} />{" "}
            배치안을 검토했으며 확정을 승인합니다
          </label>
          <button
            className="primary"
            disabled={busy || !approved || task.accepted_count !== task.required_workers}
            onClick={() => void run(() => api.confirm(task.id, approved))}
          >
            배치 확정
          </button>
          {task.accepted_count !== task.required_workers && (
            <span className="muted"> 필요 인원 {task.required_workers}명 모두 수락해야 확정할 수 있습니다 (현재 {task.accepted_count}명). 일손은 '일손으로 시작'에서 수락합니다.</span>
          )}
        </div>
      )}

      {open && sug && (
        <>
          <h3>후보 검토</h3>
          {sug.shortage > 0 && (
            <div className="error">
              인원 부족: {sug.shortage}명 부족합니다. {sug.shortage_reason}
            </div>
          )}
          {sug.candidates.map((c) => (
            <div className="card" key={c.candidate_id}>
              <div className="row">
                {c.eligible && (!c.assignment_status || c.assignment_status === "applied") && (
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    checked={picked.includes(c.candidate_id)}
                    disabled={!picked.includes(c.candidate_id) && picked.length >= slots}
                    onChange={() => toggle(c)}
                  />
                )}
                <strong className="grow">
                  {c.display_name}
                  {c.origin === "public" && <span className="badge"> 공개 지원자</span>}
                </strong>
                {c.assignment_status === "applied" && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      const a = task.assignments.find((x) => x.worker_id === c.candidate_id && x.status === "applied");
                      if (a) void run(() => api.decline(a.id));
                    }}
                  >
                    지원 거절
                  </button>
                )}
                {c.assignment_status ? (
                  <span className="badge">{ASSIGNMENT_STATUS_LABEL[c.assignment_status]}</span>
                ) : c.eligible ? (
                  <span className="badge confirmed">배치 가능 · 추천도 {c.score}</span>
                ) : (
                  <span className="badge cancelled">배치 불가</span>
                )}
              </div>
              {c.origin === "public" && (c.experience || c.intro) && (
                <div className="muted">
                  {c.experience && <div>경력: {c.experience}</div>}
                  {c.intro && <div>소개: {c.intro}</div>}
                  <div>※ 신원·평점은 확인되지 않은 지원자입니다.</div>
                </div>
              )}
              <ul>
                {c.reasons.map((r) => <li key={r} className="ok">✔ {r}</li>)}
                {c.warnings.map((r) => <li key={r} className="warn">⚠ {r}</li>)}
                {c.exclusions.map((r) => <li key={r} className="bad">✖ {r}</li>)}
              </ul>
              {c.conflicts.length > 0 && (
                <div className="muted">
                  충돌 일정: {c.conflicts.map((k) => `${k.title}(${fmt(k.start_at)}~${fmt(k.end_at)})`).join(", ")}
                </div>
              )}
            </div>
          ))}
          <button
            className="primary"
            disabled={busy || picked.length === 0}
            onClick={() => void run(() => api.requestConfirmation(task.id, picked))}
          >
            선택한 {picked.length}명에게 배치 요청
          </button>
          <span className="muted"> 지원자를 선택하면 지원이 사전 동의로 처리되어 바로 수락 상태가 되고, 내 일손 명단은 일손이 수락해야 확정할 수 있습니다.</span>
        </>
      )}

      <h3>AI 설명</h3>
      <div className="card">
        <button disabled={ai.phase === "loading"} onClick={() => void askAi()}>
          {ai.phase === "error" ? "다시 시도" : "AI에게 배치 설명 요청"}
        </button>
        {ai.phase === "loading" && <div className="info">AI가 배치안을 분석하는 중입니다…</div>}
        {ai.phase === "error" && <div className="error">{ai.message}</div>}
        {ai.phase === "done" && (
          <div className="info">
            <strong>AI 초안(참고용)</strong>
            <p>{ai.plan.summary}</p>
          </div>
        )}
      </div>
    </>
  );
}
