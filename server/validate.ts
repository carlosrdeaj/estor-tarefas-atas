import {
  isDueFilter,
  isPriority,
  isStatus,
  type DueFilter,
  type Priority,
  type Status,
} from '../shared/types'
import { fold, isValidDate, isValidDateTime } from '../shared/text'
import { HttpError } from './errors'

export type TaskDraft = {
  title: string
  description: string
  status: Status
  priority: Priority
  dueDate: string | null
  assignee: string
  tags: string[]
}

export type TaskPatch = Partial<TaskDraft>

export type TaskQuery = {
  status?: Status
  priority?: Priority
  due?: DueFilter
  tag?: string
  q?: string
}

export type MeetingDraft = {
  title: string
  startsAt: string
  participants: string[]
  agenda: string
  notes: string
  decisions: { content: string }[]
  actionItems: { id: string | null; content: string; assignee: string; dueDate: string | null }[]
}

export type MeetingQuery = {
  q?: string
  participant?: string
  from?: string
  to?: string
}

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Dados inválidos.')
  }
  return body as Record<string, unknown>
}

function optionalString(value: unknown, label: string, max: number): string {
  if (value == null) return ''
  if (typeof value !== 'string') throw new HttpError(400, `${label} inválido.`)
  const trimmed = value.trim()
  if (trimmed.length > max) throw new HttpError(400, `${label} pode ter no máximo ${max} caracteres.`)
  return trimmed
}

function requiredString(value: unknown, label: string, max: number): string {
  const trimmed = optionalString(value, label, max)
  if (!trimmed) throw new HttpError(400, `Informe ${label}.`)
  return trimmed
}

function parseDue(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !isValidDate(value)) {
    throw new HttpError(400, 'Prazo inválido. Use o formato AAAA-MM-DD.')
  }
  return value
}

function parseTags(value: unknown): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new HttpError(400, 'Etiquetas inválidas.')
  if (value.length > 24) throw new HttpError(400, 'Use no máximo 24 etiquetas.')
  const tags: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') throw new HttpError(400, 'Etiquetas inválidas.')
    const tag = item.trim()
    if (!tag) continue
    if (tag.length > 32) throw new HttpError(400, 'Cada etiqueta pode ter no máximo 32 caracteres.')
    if (!tags.some((existing) => fold(existing) === fold(tag))) tags.push(tag)
  }
  return tags
}

function parseStatus(value: unknown): Status {
  if (typeof value !== 'string' || !isStatus(value)) throw new HttpError(400, 'Status inválido.')
  return value
}

function parsePriority(value: unknown): Priority {
  if (typeof value !== 'string' || !isPriority(value)) throw new HttpError(400, 'Prioridade inválida.')
  return value
}

function parseParticipants(value: unknown): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new HttpError(400, 'Participantes inválidos.')
  if (value.length > 40) throw new HttpError(400, 'Use no máximo 40 participantes.')
  const people: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') throw new HttpError(400, 'Participantes inválidos.')
    const name = item.trim()
    if (!name) continue
    if (name.length > 80) throw new HttpError(400, 'Cada participante pode ter no máximo 80 caracteres.')
    if (!people.some((existing) => fold(existing) === fold(name))) people.push(name)
  }
  return people
}

export function parseTaskCreate(body: unknown): TaskDraft {
  const data = asRecord(body)
  return {
    title: requiredString(data.title, 'o título', 180),
    description: optionalString(data.description, 'A descrição', 8000),
    status: data.status == null ? 'todo' : parseStatus(data.status),
    priority: data.priority == null ? 'medium' : parsePriority(data.priority),
    dueDate: parseDue(data.dueDate),
    assignee: optionalString(data.assignee, 'O responsável', 120),
    tags: parseTags(data.tags),
  }
}

export function parseTaskPatch(body: unknown): TaskPatch {
  const data = asRecord(body)
  const patch: TaskPatch = {}
  if ('title' in data) patch.title = requiredString(data.title, 'o título', 180)
  if ('description' in data) patch.description = optionalString(data.description, 'A descrição', 8000)
  if ('status' in data) patch.status = parseStatus(data.status)
  if ('priority' in data) patch.priority = parsePriority(data.priority)
  if ('dueDate' in data) patch.dueDate = parseDue(data.dueDate)
  if ('assignee' in data) patch.assignee = optionalString(data.assignee, 'O responsável', 120)
  if ('tags' in data) patch.tags = parseTags(data.tags)
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nenhuma alteração enviada.')
  return patch
}

function firstQueryValue(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed || undefined
}

export function parseTaskQuery(query: Record<string, unknown>): TaskQuery {
  const statusValue = firstQueryValue(query.status)
  const priorityValue = firstQueryValue(query.priority)
  const dueValue = firstQueryValue(query.due)
  if (statusValue && !isStatus(statusValue)) throw new HttpError(400, 'Status inválido.')
  if (priorityValue && !isPriority(priorityValue)) throw new HttpError(400, 'Prioridade inválida.')
  if (dueValue && !isDueFilter(dueValue)) throw new HttpError(400, 'Filtro de prazo inválido.')
  return {
    status: statusValue && isStatus(statusValue) ? statusValue : undefined,
    priority: priorityValue && isPriority(priorityValue) ? priorityValue : undefined,
    due: dueValue && isDueFilter(dueValue) ? dueValue : undefined,
    tag: firstQueryValue(query.tag),
    q: firstQueryValue(query.q),
  }
}

export function parseMeetingDraft(body: unknown): MeetingDraft {
  const data = asRecord(body)
  const decisions = parseDecisions(data.decisions)
  const actionItems = parseActionItems(data.actionItems)
  const startsAt = requiredString(data.startsAt, 'a data e a hora', 16)
  if (!isValidDateTime(startsAt)) {
    throw new HttpError(400, 'Data da reunião inválida. Use o formato AAAA-MM-DDTHH:mm.')
  }
  return {
    title: requiredString(data.title, 'o título', 180),
    startsAt,
    participants: parseParticipants(data.participants),
    agenda: optionalString(data.agenda, 'A pauta', 20000),
    notes: optionalString(data.notes, 'As notas', 20000),
    decisions,
    actionItems,
  }
}

function parseDecisions(value: unknown): { content: string }[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new HttpError(400, 'Decisões inválidas.')
  if (value.length > 80) throw new HttpError(400, 'Use no máximo 80 decisões.')
  const decisions: { content: string }[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new HttpError(400, 'Decisões inválidas.')
    const content = optionalString((item as { content?: unknown }).content, 'A decisão', 1000)
    if (content) decisions.push({ content })
  }
  return decisions
}

function parseActionItems(value: unknown): MeetingDraft['actionItems'] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new HttpError(400, 'Itens de ação inválidos.')
  if (value.length > 80) throw new HttpError(400, 'Use no máximo 80 itens de ação.')
  const items: MeetingDraft['actionItems'] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new HttpError(400, 'Itens de ação inválidos.')
    const record = item as { id?: unknown; content?: unknown; assignee?: unknown; dueDate?: unknown }
    const content = optionalString(record.content, 'O item de ação', 180)
    if (!content) continue
    let id: string | null = null
    if (typeof record.id === 'string' && record.id.trim()) {
      id = record.id.trim()
      if (seen.has(id)) throw new HttpError(400, 'Item de ação repetido.')
      seen.add(id)
    }
    items.push({
      id,
      content,
      assignee: optionalString(record.assignee, 'O responsável', 120),
      dueDate: parseDue(record.dueDate),
    })
  }
  return items
}

export function parseMeetingQuery(query: Record<string, unknown>): MeetingQuery {
  const from = firstQueryValue(query.from)
  const to = firstQueryValue(query.to)
  if (from && !isValidDate(from)) throw new HttpError(400, 'Data inicial inválida.')
  if (to && !isValidDate(to)) throw new HttpError(400, 'Data final inválida.')
  return {
    q: firstQueryValue(query.q),
    participant: firstQueryValue(query.participant),
    from,
    to,
  }
}
