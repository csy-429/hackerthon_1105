import type { AgentPlan, AssignmentView, Demo, Message, Opportunity, Suggestions, Task, TaskInput, Worker } from "../types";

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

async function request<T>(method: string, path: string, body?: unknown, pin?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(pin ? { "X-Pin": pin } : {}),
      },
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

export type WorkerInput = Pick<Worker, "display_name" | "skills" | "availability"> & {
  pin: string;
  experience?: string;
  intro?: string;
  desired_hourly_wage?: number;
};

export const api = {
  demo: () => request<Demo>("GET", "/demo"),
  resetDemo: () => request<Demo>("POST", "/demo/reset"),
  createTask: (t: TaskInput) => request<Task>("POST", "/tasks", t),
  updateTask: (id: string, t: Partial<TaskInput>, pin: string) => request<Task>("PATCH", `/tasks/${id}`, t, pin),
  cancelTask: (id: string, pin: string) => request<Task>("POST", `/tasks/${id}/cancel`, undefined, pin),
  suggestions: (id: string) => request<Suggestions>("POST", `/tasks/${id}/suggestions`),
  requestConfirmation: (id: string, workerIds: string[], pin: string, forceWorkerIds: string[] = []) =>
    request<Task>(
      "POST",
      `/tasks/${id}/request-confirmation`,
      { worker_ids: workerIds, force_worker_ids: forceWorkerIds },
      pin,
    ),
  confirm: (id: string, approved: boolean, pin: string) =>
    request<Task>("POST", `/tasks/${id}/confirm`, { farmer_approved: approved }, pin),
  workerAssignments: (workerId: string) =>
    request<AssignmentView[]>("GET", `/assignments?worker_id=${encodeURIComponent(workerId)}`),
  accept: (id: string, pin: string) => request<AssignmentView>("POST", `/assignments/${id}/accept`, undefined, pin),
  decline: (id: string, pin: string) => request<AssignmentView>("POST", `/assignments/${id}/decline`, undefined, pin),
  createWorker: (w: WorkerInput) => request<Worker>("POST", "/workers", w),
  createPublicWorker: (w: WorkerInput) => request<Worker>("POST", "/workers?public=true", w),
  opportunities: (workerId: string) => request<Opportunity[]>("GET", `/workers/${workerId}/opportunities`),
  apply: (taskId: string, workerId: string, pin: string, force = false) =>
    request<AssignmentView>("POST", `/tasks/${taskId}/apply`, { worker_id: workerId, force }, pin),
  updateWorker: (id: string, w: Partial<Worker>, pin: string) => request<Worker>("PATCH", `/workers/${id}`, w, pin),
  messages: (assignmentId: string, pin: string) =>
    request<Message[]>("GET", `/assignments/${assignmentId}/messages`, undefined, pin),
  sendMessage: (assignmentId: string, text: string, pin: string) =>
    request<Message>("POST", `/assignments/${assignmentId}/messages`, { text }, pin),
  offerWage: (assignmentId: string, wage: number, pin: string) =>
    request<AssignmentView>("POST", `/assignments/${assignmentId}/wage-offer`, { wage }, pin),
  acceptWage: (assignmentId: string, pin: string) =>
    request<AssignmentView>("POST", `/assignments/${assignmentId}/wage-offer/accept`, undefined, pin),
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
