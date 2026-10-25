import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DUE_FILTERS, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type Status, type Task, type TaskInput } from '../../shared/types'
import { api } from '../api'
import { KanbanBoard } from '../components/KanbanBoard'
import { Modal } from '../components/Modal'
import { TaskCard } from '../components/TaskCard'
import { TaskDialog } from '../components/TaskDialog'

const DUE_LABEL = {
  overdue: 'Atrasadas',
  today: 'Hoje',
  week: 'Próximos 7 dias',
  later: 'Depois disso',
  none: 'Sem prazo',
} as const

function initialView(): 'list' | 'board' {
  try {
    return localStorage.getItem('pauta-task-view') === 'board' ? 'board' : 'list'
  } catch {
    return 'list'
  }
}

export function TasksPage() {
  const { taskId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const status = params.get('status') ?? ''
  const priority = params.get('priority') ?? ''
  const due = params.get('due') ?? ''
  const tag = params.get('tag') ?? ''
  const q = params.get('q') ?? ''
  const creating = params.get('nova') === '1' && !taskId
  const [qInput, setQInput] = useState(q)
  const [view, setView] = useState<'list' | 'board'>(initialView)
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [today, setToday] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [dialogTask, setDialogTask] = useState<Task | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Tarefas · Pauta'
  }, [])

  useEffect(() => {
    setQInput(q)
  }, [q])

  useEffect(() => {
    if (qInput === q) return
    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (qInput) next.set('q', qInput)
      else next.delete('q')
      setParams(next, { replace: true })
    }, 250)
    return () => window.clearTimeout(handle)
  }, [qInput, q, params, setParams])

  useEffect(() => {
    let cancelled = false
    api
      .listTasks({
        status: status || undefined,
        priority: priority || undefined,
        due: due || undefined,
        tag: tag || undefined,
        q: q || undefined,
      })
      .then((response) => {
        if (cancelled) return
        setTasks(response.tasks)
        setTags(response.tags)
        setToday(response.today)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as tarefas.')
      })
    return () => {
      cancelled = true
    }
  }, [status, priority, due, tag, q, version])

  useEffect(() => {
    if (!taskId) {
      setDialogTask(null)
      setDialogError(null)
      setDialogLoading(false)
      return
    }
    let cancelled = false
    setDialogLoading(true)
    setDialogTask(null)
    api
      .task(taskId)
      .then((task) => {
        if (cancelled) return
        setDialogTask(task)
        setDialogError(null)
        setDialogLoading(false)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setDialogTask(null)
        setDialogError(reason instanceof Error ? reason.message : 'Não foi possível abrir a tarefa.')
        setDialogLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [taskId])

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  function clearFilters() {
    const next = new URLSearchParams(params)
    for (const key of ['status', 'priority', 'due', 'tag', 'q']) next.delete(key)
    setParams(next, { replace: true })
    setQInput('')
  }

  function closeDialog() {
    const next = new URLSearchParams(params)
    next.delete('nova')
    navigate({ pathname: '/tarefas', search: next.toString() }, { replace: true })
  }

  function taskHref(task: Task) {
    const next = new URLSearchParams(params)
    next.delete('nova')
    const search = next.toString()
    return `/tarefas/${task.id}${search ? `?${search}` : ''}`
  }

  async function saveTask(input: TaskInput) {
    setBusy(true)
    setDialogError(null)
    try {
      if (dialogTask) await api.updateTask(dialogTask.id, input)
      else await api.createTask(input)
      setVersion((current) => current + 1)
      closeDialog()
    } catch (reason) {
      setDialogError(reason instanceof Error ? reason.message : 'Não foi possível salvar a tarefa.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteTask() {
    if (!dialogTask) return
    setBusy(true)
    setDialogError(null)
    try {
      await api.deleteTask(dialogTask.id)
      setVersion((current) => current + 1)
      closeDialog()
    } catch (reason) {
      setDialogError(reason instanceof Error ? reason.message : 'Não foi possível excluir a tarefa.')
    } finally {
      setBusy(false)
    }
  }

  async function moveTask(task: Task, nextStatus: Status) {
    const previous = tasks
    setTasks((current) => current?.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item)) ?? current)
    try {
      await api.updateTask(task.id, { status: nextStatus })
      setVersion((current) => current + 1)
    } catch (reason) {
      setTasks(previous)
      setError(reason instanceof Error ? reason.message : 'Não foi possível mover a tarefa.')
    }
  }

  function chooseView(next: 'list' | 'board') {
    setView(next)
    try {
      localStorage.setItem('pauta-task-view', next)
    } catch {
      // A preferência só não fica gravada.
    }
  }

  const filtersActive = Boolean(status || priority || due || tag || q)
  const countLabel = tasks == null ? '' : tasks.length === 1 ? '1 tarefa' : `${tasks.length} tarefas`

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Lista e quadro</p>
          <h1>Tarefas</h1>
          <p className="lede">Anote, filtre e arraste entre A fazer, Em andamento e Concluída.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => navigate({ pathname: '/tarefas', search: new URLSearchParams({ ...Object.fromEntries(params), nova: '1' }).toString() })}>
          Nova tarefa
        </button>
      </header>

      {error && (
        <p className="banner" role="alert">
          {error}
        </p>
      )}

      <div className="toolbar">
        <div className="filters">
          <label className="field grow">
            <span>Busca</span>
            <input
              name="busca"
              type="search"
              value={qInput}
              placeholder="Título, descrição, responsável ou etiqueta"
              onChange={(event) => setQInput(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" value={status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Todos</option>
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {STATUS_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Prioridade</span>
            <select name="prioridade" value={priority} onChange={(event) => updateFilter('priority', event.target.value)}>
              <option value="">Todas</option>
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {PRIORITY_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Prazo</span>
            <select name="prazo" value={due} onChange={(event) => updateFilter('due', event.target.value)}>
              <option value="">Qualquer prazo</option>
              {DUE_FILTERS.map((item) => (
                <option key={item} value={item}>
                  {DUE_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Etiqueta</span>
            <select name="etiqueta" value={tag} onChange={(event) => updateFilter('tag', event.target.value)}>
              <option value="">Todas</option>
              {tags.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              {tag && !tags.includes(tag) && <option value={tag}>{tag}</option>}
            </select>
          </label>
          {filtersActive && (
            <button type="button" className="btn" onClick={clearFilters}>
              Limpar
            </button>
          )}
        </div>
        <div className="toolbar-side">
          <p className="result-count">{countLabel}</p>
          <div className="segmented" role="tablist" aria-label="Visualização">
            <button type="button" role="tab" aria-selected={view === 'list'} onClick={() => chooseView('list')}>
              Lista
            </button>
            <button type="button" role="tab" aria-selected={view === 'board'} onClick={() => chooseView('board')}>
              Quadro
            </button>
          </div>
        </div>
      </div>

      {tasks == null && !error && <p className="loading">Carregando tarefas…</p>}
      {tasks && view === 'list' && tasks.length === 0 && (
        <div className="empty">
          <h2>Nenhuma tarefa por aqui</h2>
          <p>{filtersActive ? 'Nada corresponde a esses filtros.' : 'Quando surgir algo para fazer, anote aqui.'}</p>
        </div>
      )}
      {tasks && view === 'list' && tasks.length > 0 && (
        <div className="task-list">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} today={today} href={taskHref(task)} showExcerpt />
          ))}
        </div>
      )}
      {tasks && view === 'board' && (
        <KanbanBoard tasks={tasks} today={today} hrefFor={taskHref} onMove={(task, next) => void moveTask(task, next)} />
      )}

      {taskId && dialogLoading && (
        <Modal title="Tarefa" onClose={closeDialog}>
          <p>Carregando…</p>
        </Modal>
      )}
      {taskId && !dialogLoading && dialogError && !dialogTask && (
        <Modal title="Tarefa" onClose={closeDialog}>
          <p className="banner" role="alert">
            {dialogError}
          </p>
        </Modal>
      )}
      {(creating || dialogTask) && (
        <TaskDialog
          key={dialogTask?.id ?? 'nova'}
          task={dialogTask}
          busy={busy}
          error={dialogError}
          onClose={closeDialog}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}
    </div>
  )
}
