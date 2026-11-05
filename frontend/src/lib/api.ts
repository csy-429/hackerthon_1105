import type { AgentPlan, AssignmentView, Demo, Suggestions, Task, TaskInput, Worker } from "../types";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public fieldErrors: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요", "network_error", 0);
  }
  if (!res.ok) {
    let detail: { code?: string; message?: string; details?: { errors?: { field: string; message: string }[] } } = {};
    try {
      detail = (await res.json()).detail ?? {};
    } catch {
      /* 본문이 JSON이 아닌 경우 */
    }
    throw new ApiError(
      detail.message ?? `요청에 실패했습니다 (${res.status})`,
      detail.code ?? "unknown",
      res.status,
      detail.details?.errors ?? [],
    );
  }
  return (await res.json()) as T;
}

export const api = {
  demo: () => request<Demo>("GET", "/demo"),
  resetDemo: () => request<Demo>("POST", "/demo/reset"),
  createTask: (t: TaskInput) => request<Task>("POST", "/tasks", t),
  updateTask: (id: string, t: Partial<TaskInput>) => request<Task>("PATCH", `/tasks/${id}`, t),
  cancelTask: (id: string) => request<Task>("POST", `/tasks/${id}/cancel`),
  suggestions: (id: string) => request<Suggestions>("POST", `/tasks/${id}/suggestions`),
  requestConfirmation: (id: string, workerIds: string[]) =>
    request<Task>("POST", `/tasks/${id}/request-confirmation`, { worker_ids: workerIds }),
  confirm: (id: string, approved: boolean) =>
    request<Task>("POST", `/tasks/${id}/confirm`, { farmer_approved: approved }),
  workerAssignments: (workerId: string) =>
    request<AssignmentView[]>("GET", `/assignments?worker_id=${encodeURIComponent(workerId)}`),
  accept: (id: string) => request<AssignmentView>("POST", `/assignments/${id}/accept`),
  decline: (id: string) => request<AssignmentView>("POST", `/assignments/${id}/decline`),
  createWorker: (w: Pick<Worker, "display_name" | "skills" | "availability">) =>
    request<Worker>("POST", "/workers", w),
  updateWorker: (id: string, w: Partial<Worker>) => request<Worker>("PATCH", `/workers/${id}`, w),
  plan: (taskId: string, text: string) =>
    request<AgentPlan>("POST", "/agent/plan", { task_id: taskId, request: text }),
};

export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    const fields = e.fieldErrors.map((f) => `${f.field}: ${f.message}`).join(" / ");
    return fields ? `${e.message} (${fields})` : e.message;
  }
  return "알 수 없는 오류가 발생했습니다";
}
