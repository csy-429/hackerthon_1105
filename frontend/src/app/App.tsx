import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "../lib/api";
import type { Demo } from "../types";
import { TaskDetailPage } from "../pages/TaskDetailPage";
import { TasksPage } from "../pages/TasksPage";
import { WorkersPage } from "../pages/WorkersPage";

type Tab = "tasks" | "workers";

export function App() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [tab, setTab] = useState<Tab>("tasks");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        <h1>일손잇다</h1>
        <nav>
          <button className={tab === "tasks" ? "active" : ""} onClick={() => { setTab("tasks"); setSelected(null); }}>
            작업·일정
          </button>
          <button className={tab === "workers" ? "active" : ""} onClick={() => setTab("workers")}>
            일손
          </button>
        </nav>
        <span className="grow" />
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
        {demo && tab === "tasks" && !task && (
          <TasksPage demo={demo} onChanged={refresh} onSelect={setSelected} />
        )}
        {demo && tab === "tasks" && task && (
          <TaskDetailPage task={task} demo={demo} onChanged={refresh} onBack={() => setSelected(null)} />
        )}
        {demo && tab === "workers" && <WorkersPage workers={demo.workers} onChanged={refresh} />}
      </main>
    </>
  );
}
