import { randomUUID } from 'node:crypto'
import { and, asc, eq, gte, inArray, isNull, lt, lte, sql, type SQL } from 'drizzle-orm'
import type { ActionItem, DashboardData, Meeting, MeetingSummary, Priority, Status, Task } from '../shared/types'
import { isPriority, isStatus } from '../shared/types'
import { addDays, fold, formatLongDatePt, greetingFor, likeContains, todayInSaoPaulo } from '../shared/text'
import { getDb, withTransaction } from './db'
import { HttpError } from './errors'
import { actionItems, decisions, meetings, settings, tasks } from './schema'
import type { MeetingDraft, MeetingQuery, TaskDraft, TaskPatch, TaskQuery } from './validate'

const LINKED_TAG = 'reunião'

function nowIso(): string {
  return new Date().toISOString()
}

function readStringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

function asStatus(value: string): Status {
  return isStatus(value) ? value : 'todo'
}

function asPriority(value: string): Priority {
  return isPriority(value) ? value : 'medium'
}

function priorityRank(priority: Priority): number {
  if (priority === 'high') return 0
  if (priority === 'medium') return 1
  return 2
}

function taskSearchParts(parts: Array<string | null | undefined>): string {
  return fold(parts.filter(Boolean).join(' '))
}

function recomputeTaskSearch(taskId: string) {
  const { db } = getDb()
  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) return
  let meetingTitle = ''
  if (task.meetingId) {
    meetingTitle = db.select({ title: meetings.title }).from(meetings).where(eq(meetings.id, task.meetingId)).get()?.title ?? ''
  }
  const searchText = taskSearchParts([
    task.title,
    task.description,
    task.assignee,
    readStringList(task.tags).join(' '),
    meetingTitle,
  ])
  db.update(tasks).set({ searchText }).where(eq(tasks.id, taskId)).run()
}

function recomputeMeetingSearch(meetingId: string) {
  const { db } = getDb()
  const meeting = db.select().from(meetings).where(eq(meetings.id, meetingId)).get()
  if (!meeting) return
  const decisionRows = db.select().from(decisions).where(eq(decisions.meetingId, meetingId)).all()
  const actionRows = db.select().from(actionItems).where(eq(actionItems.meetingId, meetingId)).all()
  const taskTitles: string[] = []
  for (const action of actionRows) {
    if (!action.taskId) continue
    const task = db.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, action.taskId)).get()
    if (task) taskTitles.push(task.title)
  }
  const participants = readStringList(meeting.participants)
  const searchText = taskSearchParts([
    meeting.title,
    meeting.agenda,
    meeting.notes,
    participants.join(' '),
    decisionRows.map((row) => row.content).join(' '),
    actionRows.map((row) => `${row.content} ${row.assignee}`).join(' '),
    taskTitles.join(' '),
  ])
  db.update(meetings)
    .set({
      searchText,
      participantsSearch: fold(participants.join('\n')),
    })
    .where(eq(meetings.id, meetingId))
    .run()
}

function readTask(row: typeof tasks.$inferSelect, meeting: { id: string; title: string } | null): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: asStatus(row.status),
    priority: asPriority(row.priority),
    dueDate: row.dueDate,
    assignee: row.assignee,
    tags: readStringList(row.tags),
    meeting,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function selectTaskRows(filter?: SQL) {
  const { db } = getDb()
  const query = db
    .select({
      task: tasks,
      meetingId: meetings.id,
      meetingTitle: meetings.title,
    })
    .from(tasks)
    .leftJoin(meetings, eq(tasks.meetingId, meetings.id))
  const rows = filter ? query.where(filter).all() : query.all()
  return rows.map((row) =>
    readTask(row.task, row.meetingId && row.meetingTitle ? { id: row.meetingId, title: row.meetingTitle } : null),
  )
}

function compareTasks(a: Task, b: Task): number {
  if (a.dueDate && !b.dueDate) return -1
  if (!a.dueDate && b.dueDate) return 1
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority)
  if (byPriority !== 0) return byPriority
  return a.title.localeCompare(b.title, 'pt-BR')
}

function taskFilter(query: TaskQuery, today: string): SQL | undefined {
  const conditions: SQL[] = []
  if (query.status) conditions.push(eq(tasks.status, query.status))
  if (query.priority) conditions.push(eq(tasks.priority, query.priority))
  if (query.q) {
    conditions.push(sql`${tasks.searchText} LIKE ${likeContains(fold(query.q))} ESCAPE '\\'`)
  }
  if (query.due === 'overdue') {
    conditions.push(sql`${tasks.dueDate} IS NOT NULL AND ${tasks.dueDate} < ${today}`)
    conditions.push(sql`${tasks.status} != 'done'`)
  }
  if (query.due === 'today') conditions.push(eq(tasks.dueDate, today))
  if (query.due === 'week') {
    conditions.push(gte(tasks.dueDate, today))
    conditions.push(lte(tasks.dueDate, addDays(today, 7)))
  }
  if (query.due === 'later') conditions.push(sql`${tasks.dueDate} > ${addDays(today, 7)}`)
  if (query.due === 'none') conditions.push(isNull(tasks.dueDate))
  return conditions.length ? and(...conditions) : undefined
}

export function listTags(): string[] {
  const { db } = getDb()
  const rows = db.select({ tags: tasks.tags }).from(tasks).all()
  const unique = new Map<string, string>()
  for (const row of rows) {
    for (const tag of readStringList(row.tags)) {
      const key = fold(tag)
      if (!unique.has(key)) unique.set(key, tag)
    }
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function listTasks(query: TaskQuery): { today: string; tasks: Task[]; tags: string[] } {
  const today = todayInSaoPaulo()
  let found = selectTaskRows(taskFilter(query, today))
  if (query.tag) {
    const needle = fold(query.tag)
    found = found.filter((task) => task.tags.some((tag) => fold(tag) === needle))
  }
  found.sort(compareTasks)
  return { today, tasks: found, tags: listTags() }
}

export function getTask(id: string): Task | null {
  return selectTaskRows(eq(tasks.id, id))[0] ?? null
}

function mustGetTask(id: string): Task {
  const task = getTask(id)
  if (!task) throw new HttpError(404, 'Tarefa não encontrada.')
  return task
}

function insertTask(input: TaskDraft & { meetingId: string | null }): string {
  const { db } = getDb()
  const id = randomUUID()
  const now = nowIso()
  db.insert(tasks)
    .values({
      id,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate,
      assignee: input.assignee,
      tags: JSON.stringify(input.tags),
      searchText: '',
      meetingId: input.meetingId,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  recomputeTaskSearch(id)
  return id
}

function syncLinkedAction(taskId: string, title: string, assignee: string, dueDate: string | null) {
  const { db } = getDb()
  db.update(actionItems)
    .set({ content: title, assignee, dueDate })
    .where(eq(actionItems.taskId, taskId))
    .run()
}

export function createTask(draft: TaskDraft): Task {
  return withTransaction(() => {
    const id = insertTask({ ...draft, meetingId: null })
    return mustGetTask(id)
  })
}

export function updateTask(id: string, patch: TaskPatch): Task {
  return withTransaction(() => {
    const { db } = getDb()
    const current = db.select().from(tasks).where(eq(tasks.id, id)).get()
    if (!current) throw new HttpError(404, 'Tarefa não encontrada.')
    const next = {
      title: patch.title ?? current.title,
      description: patch.description ?? current.description,
      status: patch.status ?? asStatus(current.status),
      priority: patch.priority ?? asPriority(current.priority),
      dueDate: patch.dueDate === undefined ? current.dueDate : patch.dueDate,
      assignee: patch.assignee ?? current.assignee,
      tags: patch.tags ?? readStringList(current.tags),
    }
    db.update(tasks)
      .set({
        title: next.title,
        description: next.description,
        status: next.status,
        priority: next.priority,
        dueDate: next.dueDate,
        assignee: next.assignee,
        tags: JSON.stringify(next.tags),
        updatedAt: nowIso(),
      })
      .where(eq(tasks.id, id))
      .run()
    recomputeTaskSearch(id)
    if (current.meetingId) {
      syncLinkedAction(id, next.title, next.assignee, next.dueDate)
      recomputeMeetingSearch(current.meetingId)
    }
    return mustGetTask(id)
  })
}

export function deleteTask(id: string): void {
  withTransaction(() => {
    const { db } = getDb()
    const current = db.select().from(tasks).where(eq(tasks.id, id)).get()
    if (!current) throw new HttpError(404, 'Tarefa não encontrada.')
    db.delete(tasks).where(eq(tasks.id, id)).run()
    if (current.meetingId) recomputeMeetingSearch(current.meetingId)
  })
}

function actionStats(ids: string[]): Map<string, { total: number; done: number }> {
  const stats = new Map<string, { total: number; done: number }>()
  if (ids.length === 0) return stats
  const { db } = getDb()
  const rows = db
    .select({ meetingId: actionItems.meetingId, status: tasks.status })
    .from(actionItems)
    .leftJoin(tasks, eq(actionItems.taskId, tasks.id))
    .where(inArray(actionItems.meetingId, ids))
    .all()
  for (const row of rows) {
    const current = stats.get(row.meetingId) ?? { total: 0, done: 0 }
    current.total += 1
    if (row.status === 'done') current.done += 1
    stats.set(row.meetingId, current)
  }
  return stats
}

function toSummary(row: typeof meetings.$inferSelect, stats: { total: number; done: number } | undefined): MeetingSummary {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    participants: readStringList(row.participants),
    actionTotal: stats?.total ?? 0,
    actionDone: stats?.done ?? 0,
    updatedAt: row.updatedAt,
  }
}

export function listMeetings(query: MeetingQuery): MeetingSummary[] {
  const { db } = getDb()
  const conditions: SQL[] = []
  if (query.q) conditions.push(sql`${meetings.searchText} LIKE ${likeContains(fold(query.q))} ESCAPE '\\'`)
  if (query.participant) {
    conditions.push(sql`${meetings.participantsSearch} LIKE ${likeContains(fold(query.participant))} ESCAPE '\\'`)
  }
  if (query.from) conditions.push(gte(meetings.startsAt, query.from))
  if (query.to) conditions.push(lt(meetings.startsAt, addDays(query.to, 1)))
  const filter = conditions.length ? and(...conditions) : undefined
  const base = db.select().from(meetings)
  const rows = (filter ? base.where(filter) : base).all()
  rows.sort((a, b) => b.startsAt.localeCompare(a.startsAt) || b.updatedAt.localeCompare(a.updatedAt))
  const stats = actionStats(rows.map((row) => row.id))
  return rows.map((row) => toSummary(row, stats.get(row.id)))
}

export function getMeeting(id: string): Meeting | null {
  const { db } = getDb()
  const meeting = db.select().from(meetings).where(eq(meetings.id, id)).get()
  if (!meeting) return null
  const decisionRows = db
    .select()
    .from(decisions)
    .where(eq(decisions.meetingId, id))
    .orderBy(asc(decisions.position))
    .all()
  const actionRows = db
    .select()
    .from(actionItems)
    .where(eq(actionItems.meetingId, id))
    .orderBy(asc(actionItems.position))
    .all()
  const taskIds = actionRows.flatMap((row) => (row.taskId ? [row.taskId] : []))
  const taskRows = taskIds.length === 0 ? [] : db.select().from(tasks).where(inArray(tasks.id, taskIds)).all()
  const tasksById = new Map(taskRows.map((row) => [row.id, row]))
  const items: ActionItem[] = actionRows.map((row) => {
    const task = row.taskId ? tasksById.get(row.taskId) : undefined
    return {
      id: row.id,
      content: task?.title ?? row.content,
      assignee: task?.assignee ?? row.assignee,
      dueDate: task ? task.dueDate : row.dueDate,
      task: task
        ? {
            id: task.id,
            title: task.title,
            status: asStatus(task.status),
            assignee: task.assignee,
            dueDate: task.dueDate,
          }
        : null,
    }
  })
  return {
    id: meeting.id,
    title: meeting.title,
    startsAt: meeting.startsAt,
    participants: readStringList(meeting.participants),
    agenda: meeting.agenda,
    notes: meeting.notes,
    decisions: decisionRows.map((row) => ({ id: row.id, content: row.content })),
    actionItems: items,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  }
}

function mustGetMeeting(id: string): Meeting {
  const meeting = getMeeting(id)
  if (!meeting) throw new HttpError(404, 'Ata não encontrada.')
  return meeting
}

function insertMeetingRow(id: string, draft: MeetingDraft, now: string) {
  const { db } = getDb()
  db.insert(meetings)
    .values({
      id,
      title: draft.title,
      startsAt: draft.startsAt,
      participants: JSON.stringify(draft.participants),
      participantsSearch: '',
      agenda: draft.agenda,
      notes: draft.notes,
      searchText: '',
      createdAt: now,
      updatedAt: now,
    })
    .run()
}

function replaceDecisions(meetingId: string, draft: MeetingDraft) {
  const { db } = getDb()
  db.delete(decisions).where(eq(decisions.meetingId, meetingId)).run()
  draft.decisions.forEach((decision, index) => {
    db.insert(decisions)
      .values({
        id: randomUUID(),
        meetingId,
        content: decision.content,
        position: index,
      })
      .run()
  })
}

function syncActionItems(meetingId: string, meetingTitle: string, draft: MeetingDraft) {
  const { db } = getDb()
  const existing = db.select().from(actionItems).where(eq(actionItems.meetingId, meetingId)).all()
  const byId = new Map(existing.map((row) => [row.id, row]))
  const kept = new Set(draft.actionItems.flatMap((item) => (item.id ? [item.id] : [])))

  for (const row of existing) {
    if (kept.has(row.id)) continue
    if (row.taskId) {
      db.update(tasks).set({ meetingId: null, updatedAt: nowIso() }).where(eq(tasks.id, row.taskId)).run()
      recomputeTaskSearch(row.taskId)
    }
    db.delete(actionItems).where(eq(actionItems.id, row.id)).run()
  }

  draft.actionItems.forEach((item, index) => {
    if (item.id) {
      const current = byId.get(item.id)
      if (!current || current.meetingId !== meetingId) {
        throw new HttpError(400, 'Item de ação não encontrado nesta ata.')
      }
      let taskId = current.taskId
      const linked = taskId ? db.select().from(tasks).where(eq(tasks.id, taskId)).get() : undefined
      if (linked) {
        db.update(tasks)
          .set({
            title: item.content,
            assignee: item.assignee,
            dueDate: item.dueDate,
            updatedAt: nowIso(),
          })
          .where(eq(tasks.id, linked.id))
          .run()
        recomputeTaskSearch(linked.id)
      } else {
        taskId = insertTask({
          title: item.content,
          description: `Gerada pela ata "${meetingTitle}".`,
          status: 'todo',
          priority: 'medium',
          dueDate: item.dueDate,
          assignee: item.assignee,
          tags: [LINKED_TAG],
          meetingId,
        })
      }
      db.update(actionItems)
        .set({
          content: item.content,
          assignee: item.assignee,
          dueDate: item.dueDate,
          taskId,
          position: index,
        })
        .where(eq(actionItems.id, item.id))
        .run()
      return
    }

    const taskId = insertTask({
      title: item.content,
      description: `Gerada pela ata "${meetingTitle}".`,
      status: 'todo',
      priority: 'medium',
      dueDate: item.dueDate,
      assignee: item.assignee,
      tags: [LINKED_TAG],
      meetingId,
    })
    db.insert(actionItems)
      .values({
        id: randomUUID(),
        meetingId,
        taskId,
        content: item.content,
        assignee: item.assignee,
        dueDate: item.dueDate,
        position: index,
      })
      .run()
  })
}

function saveMeeting(id: string, draft: MeetingDraft, creating: boolean): Meeting {
  return withTransaction(() => {
    const { db } = getDb()
    const now = nowIso()
    if (creating) {
      insertMeetingRow(id, draft, now)
    } else {
      const current = db.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, id)).get()
      if (!current) throw new HttpError(404, 'Ata não encontrada.')
      db.update(meetings)
        .set({
          title: draft.title,
          startsAt: draft.startsAt,
          participants: JSON.stringify(draft.participants),
          agenda: draft.agenda,
          notes: draft.notes,
          updatedAt: now,
        })
        .where(eq(meetings.id, id))
        .run()
    }
    replaceDecisions(id, draft)
    syncActionItems(id, draft.title, draft)
    recomputeMeetingSearch(id)
    return mustGetMeeting(id)
  })
}

export function createMeeting(draft: MeetingDraft): Meeting {
  return saveMeeting(randomUUID(), draft, true)
}

export function updateMeeting(id: string, draft: MeetingDraft): Meeting {
  return saveMeeting(id, draft, false)
}

export function deleteMeeting(id: string): void {
  withTransaction(() => {
    const { db } = getDb()
    const current = db.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, id)).get()
    if (!current) throw new HttpError(404, 'Ata não encontrada.')
    const linked = db.select({ id: tasks.id }).from(tasks).where(eq(tasks.meetingId, id)).all()
    db.delete(meetings).where(eq(meetings.id, id)).run()
    for (const task of linked) recomputeTaskSearch(task.id)
  })
}

export function getDashboard(): DashboardData {
  const { db } = getDb()
  const today = todayInSaoPaulo()
  const rows = db.select({ status: tasks.status, dueDate: tasks.dueDate }).from(tasks).all()
  const counts = { todo: 0, in_progress: 0, done: 0, overdue: 0 }
  for (const row of rows) {
    const status = asStatus(row.status)
    counts[status] += 1
    if (status !== 'done' && row.dueDate && row.dueDate < today) counts.overdue += 1
  }
  const todayTasks = listTasks({ due: 'today' }).tasks.filter((task) => task.status !== 'done').slice(0, 8)
  const overdueTasks = listTasks({ due: 'overdue' }).tasks.filter((task) => task.status !== 'done').slice(0, 8)
  const recentMeetings = listMeetings({}).slice(0, 5)
  return {
    today,
    greeting: greetingFor(),
    dateLabel: formatLongDatePt(),
    counts,
    todayTasks,
    overdueTasks,
    recentMeetings,
  }
}

export function clearAll(): void {
  const { db } = getDb()
  db.delete(tasks).run()
  db.delete(meetings).run()
}

export function seedIfNeeded(): void {
  const { db } = getDb()
  const already = db.select().from(settings).where(eq(settings.settingKey, 'seeded')).get()
  if (already) return
  const today = todayInSaoPaulo()
  withTransaction(() => {
    const weekly = createMeeting({
      title: 'Alinhamento da semana',
      startsAt: `${today}T09:30`,
      participants: ['Ana Ribeiro', 'Bruno Martins', 'Eu'],
      agenda: 'Prioridades da semana\nPendências do relatório\nRecados rápidos',
      notes:
        'A Ana trouxe o cronograma do cliente. Ficou combinado concentrar a entrega na sexta e deixar a revisão visual para a semana que vem. Bruno fica com os números.',
      decisions: [
        { content: 'Manter a entrega principal na sexta-feira.' },
        { content: 'Adiar a revisão visual para a próxima semana.' },
      ],
      actionItems: [
        { id: null, content: 'Enviar a pauta da próxima reunião', assignee: 'Eu', dueDate: addDays(today, 1) },
        { id: null, content: 'Fechar os números do relatório', assignee: 'Bruno Martins', dueDate: addDays(today, 3) },
      ],
    })
    const coffee = createMeeting({
      title: 'Café com a Ana',
      startsAt: `${addDays(today, -6)}T16:00`,
      participants: ['Ana Ribeiro', 'Eu'],
      agenda: 'Ideias para organizar a rotina de casa.',
      notes:
        'Conversamos sem pressa. A Ana sugeriu separar as contas domésticas das tarefas de trabalho, para o painel não misturar os dois assuntos.',
      decisions: [{ content: 'Usar a etiqueta "casa" para o que não for trabalho.' }],
      actionItems: [
        { id: null, content: 'Separar as contas do mês', assignee: 'Eu', dueDate: addDays(today, -1) },
      ],
    })
    const doneTask = coffee.actionItems[0]?.task
    if (doneTask) updateTask(doneTask.id, { status: 'done' })

    createTask({
      title: 'Pagar a conta de luz',
      description: 'Vence no aplicativo do banco. Conferir o valor antes de pagar.',
      status: 'todo',
      priority: 'high',
      dueDate: addDays(today, -2),
      assignee: 'Eu',
      tags: ['casa', 'contas'],
    })
    createTask({
      title: 'Revisar o texto da reunião semanal',
      description: 'Ler com calma e marcar o que ficou vago na ata.',
      status: 'in_progress',
      priority: 'medium',
      dueDate: today,
      assignee: 'Eu',
      tags: ['trabalho'],
    })
    createTask({
      title: 'Comprar o presente da Ana',
      description: 'Algo simples. Ela mencionou um caderno novo.',
      status: 'todo',
      priority: 'low',
      dueDate: today,
      assignee: 'Eu',
      tags: ['pessoal'],
    })
    createTask({
      title: 'Organizar os documentos da gaveta',
      description: 'Já separei o que pode ir para a reciclagem.',
      status: 'done',
      priority: 'low',
      dueDate: null,
      assignee: 'Eu',
      tags: ['casa'],
    })
    createTask({
      title: 'Agendar o dentista',
      description: 'Ligar de manhã, antes de começar as tarefas do trabalho.',
      status: 'todo',
      priority: 'medium',
      dueDate: addDays(today, -5),
      assignee: 'Eu',
      tags: ['pessoal', 'saúde'],
    })
    createTask({
      title: 'Preparar a lista de compras',
      description: 'Incluir café e fruta para a semana.',
      status: 'todo',
      priority: 'medium',
      dueDate: addDays(today, 2),
      assignee: 'Eu',
      tags: ['casa'],
    })

    db.insert(settings).values({ settingKey: 'seeded', value: weekly.id }).run()
  })
}
