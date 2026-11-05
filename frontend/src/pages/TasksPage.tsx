import { useState } from "react";
import { api, describeError } from "../lib/api";
import { TASK_STATUS_LABEL, fmt, parseSkills, toInput, withSeconds } from "../lib/format";
import type { Demo, Task } from "../types";

interface Props {
  demo: Demo;
  onChanged: () => Promise<void>;
  onSelect: (id: string) => void;
}

interface Form {
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  required_workers: number;
  skills: string;
}

const EMPTY: Form = { title: "", description: "", start_at: "", end_at: "", required_workers: 1, skills: "" };

export function TasksPage({ demo, onChanged, onSelect }: Props) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const startEdit = (t: Task) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description,
      start_at: toInput(t.start_at),
      end_at: toInput(t.end_at),
      required_workers: t.required_workers,
      skills: t.required_skills.join(", "),
    });
  };

  const reset = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      title: form.title,
      description: form.description,
      start_at: withSeconds(form.start_at),
      end_at: withSeconds(form.end_at),
      required_workers: Number(form.required_workers),
      required_skills: parseSkills(form.skills),
    };
    try {
      if (editing) await api.updateTask(editing.id, body);
      else await api.createTask({ ...body, farm_id: demo.farms[0].id });
      reset();
      await onChanged();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (t: Task) => {
    if (!window.confirm(`'${t.title}' 작업을 취소할까요?`)) return;
    setError(null);
    try {
      await api.cancelTask(t.id);
      await onChanged();
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <>
      <h2>작업 일정</h2>
      {error && <div className="error">{error}</div>}
      {demo.tasks.length === 0 && <p className="muted">등록된 작업이 없습니다.</p>}
      {demo.tasks.map((t) => {
        const locked = t.status === "cancelled" || t.status === "completed";
        return (
          <div className="card" key={t.id}>
            <div className="row">
              <strong className="grow">{t.title}</strong>
              <span className={`badge ${t.status}`}>{TASK_STATUS_LABEL[t.status]}</span>
            </div>
            <div className="muted">
              {fmt(t.start_at)} ~ {fmt(t.end_at)} · 필요 {t.required_workers}명 · 조건: {t.required_skills.join(", ") || "없음"}
            </div>
            <div className="row">
              <span className="muted">수락 {t.accepted_count + t.confirmed_count}/{t.required_workers}</span>
              <progress max={t.required_workers} value={t.accepted_count + t.confirmed_count} />
              <span className="grow" />
              <button onClick={() => onSelect(t.id)}>배치 검토</button>
              <button disabled={locked} onClick={() => startEdit(t)}>수정</button>
              <button className="danger" disabled={locked} onClick={() => void cancel(t)}>취소</button>
            </div>
          </div>
        );
      })}

      <h2>{editing ? `작업 수정: ${editing.title}` : "작업 등록"}</h2>
      <form className="card" onSubmit={(e) => void submit(e)}>
        <label>제목</label>
        <input required maxLength={100} value={form.title} onChange={(e) => set({ title: e.target.value })} />
        <label>설명</label>
        <textarea maxLength={1000} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        <div className="row">
          <div className="grow">
            <label>시작</label>
            <input type="datetime-local" required value={form.start_at} onChange={(e) => set({ start_at: e.target.value })} />
          </div>
          <div className="grow">
            <label>종료</label>
            <input type="datetime-local" required value={form.end_at} onChange={(e) => set({ end_at: e.target.value })} />
          </div>
          <div>
            <label>필요 인원</label>
            <input type="number" min={1} max={50} required value={form.required_workers} onChange={(e) => set({ required_workers: Number(e.target.value) })} />
          </div>
        </div>
        <label>필요 작업 유형 (쉼표로 구분)</label>
        <input value={form.skills} placeholder="수확, 선별" onChange={(e) => set({ skills: e.target.value })} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" disabled={busy}>{editing ? "수정 저장" : "등록"}</button>
          {editing && <button type="button" onClick={reset}>편집 취소</button>}
        </div>
      </form>
    </>
  );
}
