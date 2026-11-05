import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "../lib/api";
import { PinDialog } from "../lib/pin";
import { farmerInbox, useSeenTick, workerInbox, type Inbox } from "../lib/inbox";
import type { Demo } from "../types";
import { HomePage } from "../pages/HomePage";
import { GuidePage } from "../pages/GuidePage";
import { JobPage } from "../pages/JobPage";
import { TaskDetailPage } from "../pages/TaskDetailPage";
import { TasksPage } from "../pages/TasksPage";
import { WorkersPage } from "../pages/WorkersPage";
import { WorkerPortalPage } from "../pages/WorkerPortalPage";

export type Role = "farmer" | "worker";
type Tab = "tasks" | "workers";

const ROLE_KEY = "ilson.role";
const WORKER_KEY = "ilson.workerId";
const POLL_MS = 10_000;

function loadRole(): Role | null {
  try {
    const v = window.localStorage.getItem(ROLE_KEY);
    return v === "farmer" || v === "worker" ? v : null;
  } catch {
    return null;
  }
}

function loadWorkerId(): string {
  try {
    return window.localStorage.getItem(WORKER_KEY) ?? "";
  } catch {
    return "";
  }
}

function parseJobHash(): string | null {
  const m = /^#\/jobs\/([^/?]+)/.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]) : null;
}

export function App() {
  const [role, setRoleState] = useState<Role | null>(loadRole);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [tab, setTab] = useState<Tab>("tasks");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState(false);
  const [jobId, setJobId] = useState<string | null>(parseJobHash);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [storedWorkerId, setStoredWorkerId] = useState(loadWorkerId);
  useSeenTick();

  useEffect(() => {
    const onHash = () => setJobId(parseJobHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const leaveJob = () => {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setJobId(null);
  };

  const workerId = demo?.workers.some((w) => w.id === storedWorkerId) ? storedWorkerId : (demo?.workers[0]?.id ?? "");
  const changeWorker = (id: string) => {
    setStoredWorkerId(id);
    try {
      window.localStorage.setItem(WORKER_KEY, id);
    } catch {
      /* 저장소를 쓸 수 없으면 새로고침 시 첫 일손이 선택된다 */
    }
  };

  const setRole = (next: Role | null) => {
    setRoleState(next);
    setSelected(null);
    setTab("tasks");
    try {
      if (next) window.localStorage.setItem(ROLE_KEY, next);
      else window.localStorage.removeItem(ROLE_KEY);
    } catch {
      /* 저장소를 쓸 수 없으면 새로고침 시 홈으로 돌아간다 */
    }
  };

  const load = useCallback(async (reset: boolean) => {
    setLoading(true);
    setError(null);
    try {
      setDemo(await (reset ? api.resetDemo() : api.demo()));
      if (reset) setSelected(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => load(false), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  // 알림 대신 주기적으로 조용히 새로 고쳐 배지를 갱신한다.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        setDemo(await api.demo());
      } catch {
        /* 일시적인 실패는 다음 주기에 다시 시도한다 */
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const task = demo?.tasks.find((t) => t.id === selected) ?? null;
  const inbox: Inbox | null = !demo
    ? null
    : role === "farmer"
      ? farmerInbox(demo.tasks)
      : role === "worker" && workerId
        ? workerInbox(demo.tasks, workerId)
        : null;
  const pending = inbox ? inbox.actions + inbox.unread : 0;

  useEffect(() => {
    document.title = pending > 0 ? `(${pending}) 일손잇다` : "일손잇다";
  }, [pending]);

  return (
    <>
      <header>
        <h1 style={{ cursor: "pointer" }} onClick={() => { leaveJob(); setRole(null); setGuide(false); }}>일손잇다</h1>
        {role === "farmer" && (
          <nav>
            <button className={tab === "tasks" ? "active" : ""} onClick={() => { setTab("tasks"); setSelected(null); }}>
              작업·일정
            </button>
            <button className={tab === "workers" ? "active" : ""} onClick={() => setTab("workers")}>
              일손 목록
            </button>
          </nav>
        )}
        {role && <span className="badge">{role === "farmer" ? "농장주 모드" : "일손 모드"}</span>}
        {pending > 0 && (
          <span className="badge new" title="응답이 필요한 항목 + 안 읽은 메시지">
            할 일 {inbox?.actions ?? 0} · 새 메시지 {inbox?.unread ?? 0}
          </span>
        )}
        <span className="grow" />
        {role && <button onClick={() => setRole(null)}>역할 바꾸기</button>}
        <button disabled={loading} onClick={() => void load(true)}>
          데모 데이터 불러오기(초기화)
        </button>
      </header>
      <main>
        {demo && <div className="notice">{demo.notice}</div>}
        {loading && <div className="info">불러오는 중…</div>}
        {error && (
          <div className="error">
            {error} <button onClick={() => void refresh()}>다시 시도</button>
          </div>
        )}
        {jobId && demo && (
          <JobPage
            demo={demo}
            taskId={jobId}
            onHome={() => { leaveJob(); setRole(null); }}
            onApply={() => {
              setFocusTaskId(jobId);
              leaveJob();
              setRole("worker");
            }}
          />
        )}
        {!jobId && !role && !guide && <HomePage onSelect={setRole} onGuide={() => setGuide(true)} />}
        {!jobId && !role && guide && (
          <GuidePage
            onBack={() => setGuide(false)}
            onStart={(r) => {
              setGuide(false);
              setRole(r);
            }}
          />
        )}
        {!jobId && demo && role === "farmer" && tab === "tasks" && !task && (
          <TasksPage demo={demo} onChanged={refresh} onSelect={setSelected} />
        )}
        {!jobId && demo && role === "farmer" && tab === "tasks" && task && (
          <TaskDetailPage task={task} demo={demo} onChanged={refresh} onBack={() => setSelected(null)} />
        )}
        {!jobId && demo && role === "farmer" && tab === "workers" && <WorkersPage workers={demo.workers} onChanged={refresh} />}
        {!jobId && demo && role === "worker" && (
          <WorkerPortalPage
            demo={demo}
            workerId={workerId}
            onWorkerChange={changeWorker}
            focusTaskId={focusTaskId}
            onChanged={refresh}
          />
        )}
      </main>
      <PinDialog />
    </>
  );
}
