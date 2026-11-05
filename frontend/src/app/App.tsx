import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "../lib/api";
import type { Demo } from "../types";
import { HomePage } from "../pages/HomePage";
import { GuidePage } from "../pages/GuidePage";
import { TaskDetailPage } from "../pages/TaskDetailPage";
import { TasksPage } from "../pages/TasksPage";
import { WorkersPage } from "../pages/WorkersPage";
import { WorkerPortalPage } from "../pages/WorkerPortalPage";

export type Role = "farmer" | "worker";
type Tab = "tasks" | "workers";

const ROLE_KEY = "ilson.role";

function loadRole(): Role | null {
  try {
    const v = window.localStorage.getItem(ROLE_KEY);
    return v === "farmer" || v === "worker" ? v : null;
  } catch {
    return null;
  }
}

export function App() {
  const [role, setRoleState] = useState<Role | null>(loadRole);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [tab, setTab] = useState<Tab>("tasks");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState(false);

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

  const task = demo?.tasks.find((t) => t.id === selected) ?? null;

  return (
    <>
      <header>
        <h1 style={{ cursor: "pointer" }} onClick={() => { setRole(null); setGuide(false); }}>일손잇다</h1>
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
        {!role && !guide && <HomePage onSelect={setRole} onGuide={() => setGuide(true)} />}
        {!role && guide && (
          <GuidePage
            onBack={() => setGuide(false)}
            onStart={(r) => {
              setGuide(false);
              setRole(r);
            }}
          />
        )}
        {demo && role === "farmer" && tab === "tasks" && !task && (
          <TasksPage demo={demo} onChanged={refresh} onSelect={setSelected} />
        )}
        {demo && role === "farmer" && tab === "tasks" && task && (
          <TaskDetailPage task={task} demo={demo} onChanged={refresh} onBack={() => setSelected(null)} />
        )}
        {demo && role === "farmer" && tab === "workers" && <WorkersPage workers={demo.workers} onChanged={refresh} />}
        {demo && role === "worker" && <WorkerPortalPage demo={demo} onChanged={refresh} />}
      </main>
    </>
  );
}
