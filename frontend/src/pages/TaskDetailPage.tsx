import { useCallback, useEffect, useState } from "react";
import { ApiError, api, describeError } from "../lib/api";
import { Chat } from "../components/Chat";
import { ShareLink } from "../components/ShareLink";
import { isUnread, useSeenTick } from "../lib/inbox";
import { askConfirm, askPin, notifyDone } from "../lib/pin";
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
  useSeenTick();
  const [sug, setSug] = useState<Suggestions | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<AiState>({ phase: "idle" });
  const [aiSecs, setAiSecs] = useState(0);

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

  const run = async (fn: (pin: string) => Promise<unknown>, prompt: string, onSuccess?: () => void) => {
    const pin = await askPin(prompt);
    if (!pin) return;
    setBusy(true);
    setError(null);
    try {
      await fn(pin);
      await onChanged();
      await loadSuggestions();
      onSuccess?.();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const askAi = async () => {
    setAi({ phase: "loading" });
    setAiSecs(0);
    const timer = window.setInterval(() => setAiSecs((s) => s + 1), 1000);
    const text = "이 작업의 후보 배치를 설명해 주세요";
    try {
      let plan: AgentPlan;
      try {
        plan = await api.plan(task.id, text);
      } catch (e) {
        // 일시적인 AI 처리 오류(502)만 한 번 자동 재시도한다
        if (!(e instanceof ApiError && e.status === 502)) throw e;
        plan = await api.plan(task.id, text);
      }
      setAi({ phase: "done", plan });
    } catch (e) {
      setAi({ phase: "error", message: describeError(e) });
    } finally {
      window.clearInterval(timer);
    }
  };
  const aiStep =
    aiSecs < 4 ? "매칭 결과를 읽는 중…" : aiSecs < 15 ? "AI가 후보별 설명을 작성하는 중…" : "응답이 조금 늦어지고 있어요. 최대 1분 정도 걸릴 수 있습니다…";

  const open = task.status === "draft" || task.status === "proposed";
  const slots = task.required_workers - task.active_count;
  const toggle = (c: Candidate) =>
    setPicked((p) => (p.includes(c.candidate_id) ? p.filter((x) => x !== c.candidate_id) : [...p, c.candidate_id]));
  const PIN_PROMPT = "작업 등록 때 정한 비밀번호 4자리를 입력하세요.";

  const requestPicked = async () => {
    const forced = (sug?.candidates ?? []).filter((c) => picked.includes(c.candidate_id) && !c.eligible);
    if (forced.length > 0) {
      const lines = forced.map((c) => `- ${c.display_name}: ${c.exclusions.join(", ")}`).join("\n");
      if (!(await askConfirm(`조건이 맞지 않는 일손에게도 요청합니다. 일손이 협의 후 수락할 수 있습니다.\n${lines}`))) return;
    }
    await run(
      (pin) =>
        api.requestConfirmation(task.id, picked, pin, forced.map((c) => c.candidate_id)),
      PIN_PROMPT,
      () => notifyDone("협의 요청을 보냈습니다", `선택한 일손 ${picked.length}명에게 배치를 요청했습니다. 일손이 수락하거나 채팅으로 협의하면 이 화면에 표시됩니다.`),
    );
  };

  return (
    <>
      <button onClick={onBack}>← 목록</button>
      <h2>{task.title}</h2>
      <div className="muted">
        {fmt(task.start_at)} ~ {fmt(task.end_at)} · 필요 {task.required_workers}명 · 시급 {task.hourly_wage ? `${task.hourly_wage.toLocaleString()}원` : "협의"} · 조건: {task.required_skills.join(", ") || "없음"}
      </div>
      <p>
        상태: <span className={`badge ${task.status}`}>{TASK_STATUS_LABEL[task.status]}</span>{" "}
        {task.status !== "confirmed" && <span className="muted">※ 일손이 모두 수락하고 농장주가 승인해야 확정됩니다.</span>}
      </p>
      {error && <div className="error">{error}</div>}
      {task.open_recruitment && open && <ShareLink taskId={task.id} />}

      <h3>배치 현황</h3>
      {task.assignments.length === 0 && <p className="muted">아직 배치 요청이 없습니다.</p>}
      {task.assignments.map((a) => (
        <div className="card" key={a.id}>
          <div className="row">
            <strong className="grow">{a.worker_name}</strong>
            {isUnread(a, "farmer") && <span className="badge new">새 메시지</span>}
            {a.agreed_wage && <span className="badge">합의 시급 {a.agreed_wage.toLocaleString()}원</span>}
            <span className="badge">{ASSIGNMENT_STATUS_LABEL[a.status]}</span>
          </div>
          <ul>{a.match_reasons.map((r) => <li key={r} className="ok">{r}</li>)}</ul>
          {a.override_reasons.length > 0 && (
            <ul>{a.override_reasons.map((r) => <li key={r} className="warn">조건 불일치 요청: {r}</li>)}</ul>
          )}
          <Chat assignment={a} me="farmer" onChanged={onChanged} />
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
            onClick={() => void run((pin) => api.confirm(task.id, approved, pin), PIN_PROMPT)}
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
                {(c.eligible || c.requestable) && (!c.assignment_status || c.assignment_status === "applied") && (
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
                      if (a) void run((pin) => api.decline(a.id, pin), PIN_PROMPT);
                    }}
                  >
                    지원 거절
                  </button>
                )}
                {c.assignment_status ? (
                  <span className="badge">{ASSIGNMENT_STATUS_LABEL[c.assignment_status]}</span>
                ) : c.eligible ? (
                  <span className="badge confirmed">배치 가능 · 추천도 {c.score}</span>
                ) : c.requestable ? (
                  <span className="badge proposed">조건 불일치 · 요청 가능</span>
                ) : (
                  <span className="badge cancelled">배치 불가</span>
                )}
              </div>
              {c.desired_hourly_wage && <div className="muted">희망 시급: {c.desired_hourly_wage.toLocaleString()}원</div>}
              {c.origin === "public" && (c.experience || c.intro) && (
                <div className="muted">
                  {c.experience && <div>경력: {c.experience}</div>}
                  {c.intro && <div>소개: {c.intro}</div>}
                  <div>※ 신원·평점은 확인되지 않은 지원자입니다.</div>
                </div>
              )}
              <ul>
                {c.reasons.map((r) => <li key={r} className="ok">{r}</li>)}
                {c.warnings.map((r) => <li key={r} className="warn">{r}</li>)}
                {c.exclusions.map((r) => <li key={r} className="bad">{r}</li>)}
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
            onClick={requestPicked}
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
        {ai.phase === "loading" && <div className="info">{aiStep} ({aiSecs}초)</div>}
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
