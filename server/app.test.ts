import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { addDays, todayInSaoPaulo } from '../shared/text'
import { createApp } from './app'
import { closeDatabase } from './db'
import { clearAll, seedIfNeeded } from './store'

let base = ''
let server: http.Server
let directory = ''
const today = todayInSaoPaulo()

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'pauta-'))
  const app = createApp({ dbPath: path.join(directory, 'test.db'), seed: false })
  server = http.createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  base = `http://127.0.0.1:${address.port}`
})

beforeEach(() => {
  clearAll()
})

after(async () => {
  server.close()
  await once(server, 'close')
  closeDatabase()
  await rm(directory, { recursive: true, force: true })
})

async function api(pathname: string, init?: RequestInit) {
  const response = await fetch(base + pathname, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = text
    }
  }
  return { status: response.status, body, headers: response.headers, text }
}

function taskBody(title: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ title, ...extra })
}

test('responde saúde e rejeita JSON inválido', async () => {
  const health = await api('/api/health')
  assert.equal(health.status, 200)
  assert.deepEqual(health.body, { ok: true })

  const response = await fetch(base + '/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })
  const body = (await response.json()) as { error: string }
  assert.equal(response.status, 400)
  assert.match(body.error, /JSON/)
})

test('cria, filtra, atualiza e exclui tarefas', async () => {
  const created = await api('/api/tasks', {
    method: 'POST',
    body: taskBody('Revisar a reunião', {
      description: 'Ler a ata com calma',
      priority: 'high',
      dueDate: addDays(today, -2),
      assignee: 'Eu',
      tags: ['Saúde', 'casa'],
      status: 'todo',
    }),
  })
  assert.equal(created.status, 201)
  const task = created.body as { id: string; tags: string[]; meeting: null }
  assert.equal(task.meeting, null)
  assert.deepEqual(task.tags, ['Saúde', 'casa'])

  const missing = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title: '   ' }) })
  assert.equal(missing.status, 400)

  const byText = await api('/api/tasks?q=' + encodeURIComponent('reuniao'))
  assert.equal((byText.body as { tasks: unknown[] }).tasks.length, 1)

  const byTag = await api('/api/tasks?tag=' + encodeURIComponent('saude'))
  assert.equal((byTag.body as { tasks: unknown[] }).tasks.length, 1)

  const byPriority = await api('/api/tasks?priority=low')
  assert.equal((byPriority.body as { tasks: unknown[] }).tasks.length, 0)

  const overdue = await api('/api/tasks?due=overdue')
  assert.equal((overdue.body as { tasks: unknown[] }).tasks.length, 1)

  const percent = await api('/api/tasks', { method: 'POST', body: taskBody('100% pronto') })
  assert.equal(percent.status, 201)
  const foundPercent = await api('/api/tasks?q=' + encodeURIComponent('100%'))
  assert.equal((foundPercent.body as { tasks: { title: string }[] }).tasks.some((item) => item.title === '100% pronto'), true)

  const patched = await api(`/api/tasks/${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'done', description: 'Já li' }),
  })
  assert.equal(patched.status, 200)
  const updated = patched.body as { status: string; description: string; priority: string }
  assert.equal(updated.status, 'done')
  assert.equal(updated.description, 'Já li')
  assert.equal(updated.priority, 'high')

  const noLongerOverdue = await api('/api/tasks?due=overdue')
  assert.equal((noLongerOverdue.body as { tasks: unknown[] }).tasks.length, 0)

  const removed = await api(`/api/tasks/${task.id}`, { method: 'DELETE' })
  assert.equal(removed.status, 204)
  const gone = await api(`/api/tasks/${task.id}`)
  assert.equal(gone.status, 404)
})

test('vincula ata e tarefa nos dois sentidos e exporta', async () => {
  const created = await api('/api/meetings', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Reunião de decisão',
      startsAt: `${today}T14:00`,
      participants: ['Ana Ribeiro', 'Bruno'],
      agenda: 'Fechar o escopo',
      notes: 'O Carlos comentou a frequência do relatório.',
      decisions: [{ content: 'Manter a entrega na sexta.' }],
      actionItems: [
        { content: 'Enviar a pauta', assignee: 'Ana Ribeiro', dueDate: addDays(today, 1) },
        { content: 'Revisar números', assignee: 'Bruno', dueDate: today },
      ],
    }),
  })
  assert.equal(created.status, 201)
  const meeting = created.body as {
    id: string
    actionItems: { id: string; task: { id: string; status: string } | null }[]
  }
  assert.equal(meeting.actionItems.length, 2)
  assert.ok(meeting.actionItems[0].task)
  const taskId = meeting.actionItems[0].task!.id

  const task = await api(`/api/tasks/${taskId}`)
  const taskBodyJson = task.body as { meeting: { id: string; title: string }; tags: string[]; description: string }
  assert.equal(taskBodyJson.meeting.id, meeting.id)
  assert.equal(taskBodyJson.meeting.title, 'Reunião de decisão')
  assert.ok(taskBodyJson.tags.includes('reunião'))
  assert.match(taskBodyJson.description, /Reunião de decisão/)

  const moved = await api(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }) })
  assert.equal(moved.status, 200)
  const again = await api(`/api/meetings/${meeting.id}`)
  const refreshed = again.body as { actionItems: { task: { status: string; title: string } | null; content: string }[] }
  assert.equal(refreshed.actionItems[0].task?.status, 'in_progress')
  assert.equal(refreshed.actionItems[0].content, 'Enviar a pauta')

  const renamed = await api(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ title: 'Enviar a pauta atualizada' }) })
  assert.equal(renamed.status, 200)
  const afterRename = await api(`/api/meetings/${meeting.id}`)
  const renamedMeeting = afterRename.body as { actionItems: { content: string }[] }
  assert.equal(renamedMeeting.actionItems[0].content, 'Enviar a pauta atualizada')

  const markdown = await api(`/api/meetings/${meeting.id}/markdown`)
  assert.equal(markdown.status, 200)
  assert.match(markdown.headers.get('content-type') ?? '', /markdown/)
  assert.match(markdown.headers.get('content-disposition') ?? '', /reuniao-de-decisao\.md/)
  assert.match(markdown.text, /Manter a entrega na sexta/)
  assert.match(markdown.text, /Enviar a pauta atualizada/)
  assert.match(markdown.text, /Em andamento/)

  const pdfResponse = await fetch(base + `/api/meetings/${meeting.id}/pdf`)
  const pdf = Buffer.from(await pdfResponse.arrayBuffer())
  assert.equal(pdfResponse.status, 200)
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
  assert.match(pdfResponse.headers.get('content-disposition') ?? '', /reuniao-de-decisao\.pdf/)

  const search = await api('/api/meetings?q=' + encodeURIComponent('reuniao'))
  assert.equal((search.body as unknown[]).length, 1)
  const byParticipant = await api('/api/meetings?participant=' + encodeURIComponent('ana'))
  assert.equal((byParticipant.body as unknown[]).length, 1)
  const notParticipant = await api('/api/meetings?participant=' + encodeURIComponent('carlos'))
  assert.equal((notParticipant.body as unknown[]).length, 0)
  const byNote = await api('/api/meetings?q=' + encodeURIComponent('frequencia'))
  assert.equal((byNote.body as unknown[]).length, 1)

  const period = await api(`/api/meetings?from=${today}&to=${today}`)
  assert.equal((period.body as unknown[]).length, 1)
  const future = await api(`/api/meetings?from=${addDays(today, 1)}`)
  assert.equal((future.body as unknown[]).length, 0)

  const removedAction = await api(`/api/meetings/${meeting.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Reunião de decisão',
      startsAt: `${today}T14:00`,
      participants: ['Ana Ribeiro'],
      agenda: 'Fechar o escopo',
      notes: 'O Carlos comentou a frequência do relatório.',
      decisions: [{ content: 'Manter a entrega na sexta.' }],
      actionItems: [{ id: meeting.actionItems[1].id, content: 'Revisar números', assignee: 'Bruno', dueDate: today }],
    }),
  })
  assert.equal(removedAction.status, 200)
  const kept = await api(`/api/tasks/${taskId}`)
  assert.equal(kept.status, 200)
  assert.equal((kept.body as { meeting: unknown }).meeting, null)

  const deletedTask = await api(`/api/tasks/${meeting.actionItems[1].task!.id}`, { method: 'DELETE' })
  assert.equal(deletedTask.status, 204)
  const withoutTask = await api(`/api/meetings/${meeting.id}`)
  assert.equal((withoutTask.body as { actionItems: { task: unknown }[] }).actionItems[0].task, null)

  const removedMeeting = await api(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
  assert.equal(removedMeeting.status, 204)
  const meetingGone = await api(`/api/meetings/${meeting.id}`)
  assert.equal(meetingGone.status, 404)
  const taskStill = await api(`/api/tasks/${taskId}`)
  assert.equal(taskStill.status, 200)
  assert.equal((taskStill.body as { meeting: unknown }).meeting, null)
})

test('o exemplo inicial é criado uma única vez', async () => {
  seedIfNeeded()
  const first = await api('/api/dashboard')
  const firstCounts = (first.body as { counts: { todo: number }; recentMeetings: unknown[] }).counts
  assert.ok(firstCounts.todo > 0)
  seedIfNeeded()
  const second = await api('/api/tasks')
  const tasks = (second.body as { tasks: unknown[] }).tasks
  const again = await api('/api/dashboard')
  assert.equal((again.body as { counts: { todo: number } }).counts.todo, firstCounts.todo)
  assert.ok(tasks.length > 0)
})

test('painel separa atrasadas em aberto das concluídas', async () => {
  await api('/api/tasks', {
    method: 'POST',
    body: taskBody('Conta atrasada', { dueDate: addDays(today, -3), status: 'todo', priority: 'high' }),
  })
  await api('/api/tasks', {
    method: 'POST',
    body: taskBody('Já paguei', { dueDate: addDays(today, -4), status: 'done' }),
  })
  await api('/api/tasks', {
    method: 'POST',
    body: taskBody('Entrega de hoje', { dueDate: today, status: 'in_progress' }),
  })
  await api('/api/tasks', {
    method: 'POST',
    body: taskBody('Na semana', { dueDate: addDays(today, 3), status: 'todo' }),
  })
  await api('/api/tasks', {
    method: 'POST',
    body: taskBody('Sem data', { dueDate: null, status: 'todo' }),
  })

  const dashboard = await api('/api/dashboard')
  const data = dashboard.body as {
    counts: { todo: number; in_progress: number; done: number; overdue: number }
    todayTasks: { title: string }[]
    overdueTasks: { title: string }[]
  }
  assert.equal(data.counts.todo, 3)
  assert.equal(data.counts.in_progress, 1)
  assert.equal(data.counts.done, 1)
  assert.equal(data.counts.overdue, 1)
  assert.deepEqual(data.overdueTasks.map((item) => item.title), ['Conta atrasada'])
  assert.deepEqual(data.todayTasks.map((item) => item.title), ['Entrega de hoje'])

  const week = await api('/api/tasks?due=week')
  const weekTitles = (week.body as { tasks: { title: string }[] }).tasks.map((item) => item.title)
  assert.ok(weekTitles.includes('Entrega de hoje'))
  assert.ok(weekTitles.includes('Na semana'))
  assert.equal(weekTitles.includes('Conta atrasada'), false)

  const none = await api('/api/tasks?due=none')
  assert.deepEqual((none.body as { tasks: { title: string }[] }).tasks.map((item) => item.title), ['Sem data'])
})
