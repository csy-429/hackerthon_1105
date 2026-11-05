import type { AssignmentStatus, TaskStatus } from "../types";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  draft: "초안 (배치 전)",
  proposed: "배치 요청 중 (일손 수락 대기)",
  confirmed: "확정",
  completed: "완료",
  cancelled: "취소",
};

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  proposed: "수락 대기",
  accepted: "수락함 (확정 전)",
  declined: "거절",
  confirmed: "확정",
};

export function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function toInput(iso: string): string {
  return iso.slice(0, 16);
}

export function withSeconds(local: string): string {
  return local.length === 16 ? `${local}:00` : local;
}

export function parseSkills(text: string): string[] {
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}
