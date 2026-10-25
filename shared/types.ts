export const STATUSES = ["todo", "in_progress", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DUE_FILTERS = ["atrasadas", "hoje", "semana", "sem-prazo"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number] | "";

export type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  assignee: string;
  tags: string[];
  meetingId: string | null;
  meetingTitle: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
  dueToday: boolean;
};

export type TaskInput = {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  assignee: string;
  tags: string[];
};

export type Decision = {
  id: string;
  content: string;
};

export type ActionItemInput = {
  id?: string;
  title: string;
  assignee: string;
  dueDate: string | null;
  priority: Priority;
};

export type MeetingInput = {
  title: string;
  startsAt: string;
  participants: string[];
  agenda: string;
  notes: string;
  decisions: string[];
  actionItems: ActionItemInput[];
};

export type MeetingSummary = {
  id: string;
  title: string;
  startsAt: string;
  participants: string[];
  agendaPreview: string;
  openActionItems: number;
  totalActionItems: number;
  updatedAt: string;
};

export type MeetingDetail = {
  id: string;
  title: string;
  startsAt: string;
  participants: string[];
  agenda: string;
  notes: string;
  decisions: Decision[];
  actionItems: Task[];
  createdAt: string;
  updatedAt: string;
};

export type TaskFilter = {
  q?: string;
  status?: Status | "";
  priority?: Priority | "";
  due?: DueFilter;
  tag?: string;
};

export type Dashboard = {
  today: string;
  counts: Record<Status, number>;
  dueToday: Task[];
  overdue: Task[];
  recentMeetings: MeetingSummary[];
};

export type ReorderItem = {
  id: string;
  status: Status;
  position: number;
};
