import type { DashboardData, Meeting, MeetingInput, MeetingSummary, Task, TaskInput, TaskListResponse } from '../shared/types'

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string }
    if (data.error) return data.error
  } catch {
    // A resposta de erro nem sempre vem em JSON.
  }
  return fallback
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, headers })
  if (!response.ok) throw new Error(await errorMessage(response, 'Não foi possível concluir a operação.'))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  dashboard: () => request<DashboardData>('/api/dashboard'),
  listTasks: (params: { status?: string; priority?: string; due?: string; tag?: string; q?: string }) =>
    request<TaskListResponse>(`/api/tasks${queryString(params)}`),
  task: (id: string) => request<Task>(`/api/tasks/${id}`),
  createTask: (input: TaskInput) => request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  updateTask: (id: string, input: TaskInput) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteTask: (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  listMeetings: (params: { q?: string; participant?: string; from?: string; to?: string }) =>
    request<MeetingSummary[]>(`/api/meetings${queryString(params)}`),
  meeting: (id: string) => request<Meeting>(`/api/meetings/${id}`),
  createMeeting: (input: MeetingInput) =>
    request<Meeting>('/api/meetings', { method: 'POST', body: JSON.stringify(input) }),
  updateMeeting: (id: string, input: MeetingInput) =>
    request<Meeting>(`/api/meetings/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteMeeting: (id: string) => request<void>(`/api/meetings/${id}`, { method: 'DELETE' }),
}

export async function downloadFile(path: string, fallbackName: string) {
  const response = await fetch(path)
  if (!response.ok) throw new Error(await errorMessage(response, 'Não foi possível exportar.'))
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] || fallbackName
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
