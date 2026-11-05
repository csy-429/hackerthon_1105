import { useEffect, useState } from "react";
import type { AssignmentView, Task } from "../types";

type Party = "farmer" | "worker";

const SEEN_PREFIX = "ilson.seen.";
const SEEN_EVENT = "ilson:seen";

function seenCount(assignmentId: string): number {
  try {
    return Number(window.localStorage.getItem(SEEN_PREFIX + assignmentId) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** 채팅을 열어 본 시점의 메시지 수를 이 브라우저에만 기록한다(서버에는 읽음 정보를 두지 않는다). */
export function markSeen(assignmentId: string, count: number): void {
  if (count <= seenCount(assignmentId)) return;
  try {
    window.localStorage.setItem(SEEN_PREFIX + assignmentId, String(count));
  } catch {
    /* 저장소를 쓸 수 없으면 읽음 표시가 유지되지 않을 뿐이다 */
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

/** 읽음 기록이 바뀌면 컴포넌트를 다시 그린다. */
export function useSeenTick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(SEEN_EVENT, bump);
    return () => window.removeEventListener(SEEN_EVENT, bump);
  }, []);
}

export function isUnread(a: AssignmentView, me: Party): boolean {
  return (
    a.status !== "declined" &&
    a.last_message_sender !== null &&
    a.last_message_sender !== me &&
    a.message_count > seenCount(a.id)
  );
}

export interface Inbox {
  /** 내가 답해야 하는 항목 수 */
  actions: number;
  unread: number;
}

export function farmerInbox(tasks: Task[]): Inbox {
  let actions = 0;
  let unread = 0;
  for (const t of tasks) {
    if (t.status === "cancelled" || t.status === "completed") continue;
    actions += t.assignments.filter((a) => a.status === "applied").length;
    if (t.status === "proposed" && t.accepted_count > 0 && t.accepted_count === t.required_workers) actions += 1;
    unread += t.assignments.filter((a) => isUnread(a, "farmer")).length;
  }
  return { actions, unread };
}

export function workerInbox(tasks: Task[], workerId: string): Inbox {
  let actions = 0;
  let unread = 0;
  for (const t of tasks) {
    for (const a of t.assignments) {
      if (a.worker_id !== workerId) continue;
      if (a.status === "proposed" && t.status === "proposed") actions += 1;
      if (isUnread(a, "worker")) unread += 1;
    }
  }
  return { actions, unread };
}

export function taskInbox(task: Task): Inbox {
  return farmerInbox([task]);
}
