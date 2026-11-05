export type TaskStatus = "draft" | "proposed" | "confirmed" | "completed" | "cancelled";
export type AssignmentStatus = "applied" | "proposed" | "accepted" | "declined" | "confirmed";
export type WorkerStatus = "active" | "inactive";
export type WorkerOrigin = "roster" | "public";

export interface TimeWindow {
  start: string;
  end: string;
}

export interface Worker {
  id: string;
  display_name: string;
  skills: string[];
  availability: TimeWindow[];
  status: WorkerStatus;
  origin: WorkerOrigin;
  experience: string;
  intro: string;
  desired_hourly_wage: number | null;
}

export interface AssignmentView {
  id: string;
  task_id: string;
  worker_id: string;
  worker_name: string;
  status: AssignmentStatus;
  match_reasons: string[];
  override_reasons: string[];
  agreed_wage: number | null;
  offer_wage: number | null;
  offer_by: "farmer" | "worker" | null;
  message_count: number;
  last_message_sender: "farmer" | "worker" | null;
  last_message_at: string | null;
}

export interface Message {
  id: string;
  assignment_id: string;
  sender: "farmer" | "worker";
  text: string;
  kind: "text" | "wage_offer" | "wage_accept";
  wage: number | null;
  created_at: string;
}

export interface Task {
  id: string;
  farm_id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  required_workers: number;
  required_skills: string[];
  status: TaskStatus;
  open_recruitment: boolean;
  hourly_wage: number | null;
  assignments: AssignmentView[];
  active_count: number;
  accepted_count: number;
  confirmed_count: number;
}

export interface Farm {
  id: string;
  name: string;
}

export interface ConflictInfo {
  task_id: string;
  title: string;
  start_at: string;
  end_at: string;
}

export interface Candidate {
  candidate_id: string;
  display_name: string;
  eligible: boolean;
  score: number;
  reasons: string[];
  warnings: string[];
  exclusions: string[];
  blockers: string[];
  requestable: boolean;
  desired_hourly_wage: number | null;
  conflicts: ConflictInfo[];
  assignment_status: AssignmentStatus | null;
  origin: WorkerOrigin;
  experience: string;
  intro: string;
}

export interface Opportunity {
  task: Omit<Task, "assignments" | "active_count" | "accepted_count" | "confirmed_count">;
  evaluation: Candidate;
  free_slots: number;
}

export interface Suggestions {
  task_id: string;
  required_workers: number;
  active_assignments: number;
  candidates: Candidate[];
  shortage: number;
  shortage_reason: string | null;
}

export interface Demo {
  notice: string;
  farms: Farm[];
  workers: Worker[];
  tasks: Task[];
}

export interface AgentPlan {
  task_id: string;
  summary: string;
  is_draft: boolean;
}

export interface TaskInput {
  farm_id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  required_workers: number;
  required_skills: string[];
  open_recruitment: boolean;
  hourly_wage?: number;
  pin: string;
}
