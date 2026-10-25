export const STATUSES = ['todo', 'in_progress', 'done'] as const
export type Status = (typeof STATUSES)[number]

export const PRIORITIES = ['low', 'medium', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export const DUE_FILTERS = ['overdue', 'today', 'week', 'later', 'none'] as const
export type DueFilter = (typeof DUE_FILTERS)[number]

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'A fazer',
  in_progress: 'Em andamento',
  done: 'Concluída',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value)
}

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value)
}

export function isDueFilter(value: string): value is DueFilter {
  return (DUE_FILTERS as readonly string[]).includes(value)
}

export type Task = {
  id: string
  title: string
  description: string
  status: Status
  priority: Priority
  dueDate: string | null
  assignee: string
  tags: string[]
  meeting: { id: string; title: string } | null
  createdAt: string
  updatedAt: string
}

export type TaskInput = {
  title?: string
  description?: string
  status?: Status
  priority?: Priority
  dueDate?: string | null
  assignee?: string
  tags?: string[]
}

export type TaskListResponse = {
  today: string
  tasks: Task[]
  tags: string[]
}

export type ActionItem = {
  id: string
  content: string
  assignee: string
  dueDate: string | null
  task: {
    id: string
    title: string
    status: Status
    assignee: string
    dueDate: string | null
  } | null
}

export type Meeting = {
  id: string
  title: string
  startsAt: string
  participants: string[]
  agenda: string
  notes: string
  decisions: { id: string; content: string }[]
  actionItems: ActionItem[]
  createdAt: string
  updatedAt: string
}

export type MeetingSummary = {
  id: string
  title: string
  startsAt: string
  participants: string[]
  actionTotal: number
  actionDone: number
  updatedAt: string
}

export type MeetingInput = {
  title?: string
  startsAt?: string
  participants?: string[]
  agenda?: string
  notes?: string
  decisions?: { content?: string }[]
  actionItems?: {
    id?: string
    content?: string
    assignee?: string
    dueDate?: string | null
  }[]
}

export type DashboardData = {
  today: string
  greeting: string
  dateLabel: string
  counts: {
    todo: number
    in_progress: number
    done: number
    overdue: number
  }
  todayTasks: Task[]
  overdueTasks: Task[]
  recentMeetings: MeetingSummary[]
}
