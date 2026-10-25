import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { STATUSES, STATUS_LABEL, type Meeting, type Status } from '../../shared/types'
import { todayInSaoPaulo } from '../../shared/text'
import { api, downloadFile } from '../api'
import { ChipInput } from '../components/ChipInput'
import { ConfirmDialog } from '../components/Modal'

type DecisionDraft = { key: string; content: string }
type ActionDraft = {
  key: string
  id?: string
  content: string
  assignee: string
  dueDate: string
  task: { id: string; status: Status } | null
}

type FormState = {
  title: string
  startsAt: string
  participants: string[]
  agenda: string
  notes: string
  decisions: DecisionDraft[]
  actionItems: ActionDraft[]
}

function blankAction(): ActionDraft {
  return { key: crypto.randomUUID(), content: '', assignee: '', dueDate: '', task: null }
}

function defaultStartsAt(): string {
  const today = todayInSaoPaulo()
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  )
  const next = Math.min(23, hour + 1)
  return `${today}T${String(next).padStart(2, '0')}:00`
}

function blankForm(): FormState {
  return {
    title: '',
    startsAt: defaultStartsAt(),
    participants: [],
    agenda: '',
    notes: '',
    decisions: [{ key: crypto.randomUUID(), content: '' }],
    actionItems: [blankAction()],
  }
}

function fromMeeting(meeting: Meeting): FormState {
  return {
    title: meeting.title,
    startsAt: meeting.startsAt,
    participants: meeting.participants,
    agenda: meeting.agenda,
    notes: meeting.notes,
    decisions:
      meeting.decisions.length > 0
        ? meeting.decisions.map((decision) => ({ key: decision.id, content: decision.content }))
        : [{ key: crypto.randomUUID(), content: '' }],
    actionItems:
      meeting.actionItems.length > 0
        ? meeting.actionItems.map((item) => ({
            key: item.id,
            id: item.id,
            content: item.content,
            assignee: item.assignee,
            dueDate: item.dueDate ?? '',
            task: item.task ? { id: item.task.id, status: item.task.status } : null,
          }))
        : [blankAction()],
  }
}

export function MeetingPage() {
  const { meetingId } = useParams()
  const isNew = !meetingId
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState<FormState>(blankForm)
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  useEffect(() => {
    document.title = isNew ? 'Nova ata · Pauta' : 'Ata · Pauta'
  }, [isNew])

  useEffect(() => {
    const state = location.state as { notice?: string } | null
    if (state?.notice) setNotice(state.notice)
  }, [location.state])

  useEffect(() => {
    if (!notice) return
    const handle = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(handle)
  }, [notice])

  useEffect(() => {
    if (!meetingId) return
    let cancelled = false
    setLoading(true)
    api
      .meeting(meetingId)
      .then((meeting) => {
        if (cancelled) return
        setForm(fromMeeting(meeting))
        setError(null)
        setLoading(false)
        document.title = `${meeting.title} · Pauta`
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a ata.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [meetingId])

  function updateAction(key: string, patch: Partial<ActionDraft>) {
    setForm((current) => ({
      ...current,
      actionItems: current.actionItems.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) {
      setError('Informe o título.')
      return
    }
    if (!form.startsAt) {
      setError('Informe a data e a hora.')
      return
    }
    if (form.actionItems.some((item) => item.id && !item.content.trim())) {
      setError('Preencha o texto do item de ação ou remova a linha.')
      return
    }
    setBusy(true)
    setError(null)
    const payload = {
      title: form.title.trim(),
      startsAt: form.startsAt,
      participants: form.participants,
      agenda: form.agenda.trim(),
      notes: form.notes.trim(),
      decisions: form.decisions.filter((item) => item.content.trim()).map((item) => ({ content: item.content.trim() })),
      actionItems: form.actionItems
        .filter((item) => item.content.trim())
        .map((item) => ({
          id: item.id,
          content: item.content.trim(),
          assignee: item.assignee.trim(),
          dueDate: item.dueDate || null,
        })),
    }
    try {
      if (isNew) {
        const created = await api.createMeeting(payload)
        navigate(`/reunioes/${created.id}`, { replace: true, state: { notice: 'Ata salva.' } })
      } else if (meetingId) {
        const updated = await api.updateMeeting(meetingId, payload)
        setForm(fromMeeting(updated))
        setNotice('Ata salva.')
        document.title = `${updated.title} · Pauta`
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a ata.')
    } finally {
      setBusy(false)
    }
  }

  async function removeMeeting() {
    if (!meetingId) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteMeeting(meetingId)
      navigate('/reunioes')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir a ata.')
      setBusy(false)
      setConfirming(false)
    }
  }

  async function changeStatus(taskId: string, status: Status) {
    setPendingStatus(taskId)
    setError(null)
    try {
      await api.updateTask(taskId, { status })
      setForm((current) => ({
        ...current,
        actionItems: current.actionItems.map((item) =>
          item.task?.id === taskId && item.task ? { ...item, task: { ...item.task, status } } : item,
        ),
      }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o status.')
    } finally {
      setPendingStatus(null)
    }
  }

  async function exportAs(kind: 'markdown' | 'pdf') {
    if (!meetingId) return
    setError(null)
    try {
      await downloadFile(`/api/meetings/${meetingId}/${kind}`, kind === 'pdf' ? 'ata.pdf' : 'ata.md')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível exportar.')
    }
  }

  if (loading) return <p className="loading">Carregando a ata…</p>
  if (!isNew && error && form.title === '' && !form.agenda) {
    return (
      <div className="empty">
        <h1>Ata não encontrada</h1>
        <p>{error}</p>
        <Link className="btn primary" to="/reunioes">
          Voltar às reuniões
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{isNew ? 'Nova reunião' : 'Ata'}</p>
          <h1>{isNew ? 'Registrar reunião' : form.title || 'Ata'}</h1>
          <p className="lede">Cada item de ação vira uma tarefa, com responsável e prazo.</p>
        </div>
        <div className="hero-actions">
          {!isNew && (
            <>
              <button type="button" className="btn" onClick={() => void exportAs('markdown')}>
                Exportar Markdown
              </button>
              <button type="button" className="btn" onClick={() => void exportAs('pdf')}>
                Exportar PDF
              </button>
            </>
          )}
          <button type="submit" form="meeting-form" className="btn primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar ata'}
          </button>
        </div>
      </header>

      {notice && (
        <p className="banner success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="banner" role="alert">
          {error}
        </p>
      )}

      <form id="meeting-form" className="meeting-form" onSubmit={(event) => void save(event)}>
        <section className="panel">
          <div className="form-grid">
            <label className="field">
              <span>Título</span>
              <input
                name="titulo"
                value={form.title}
                maxLength={180}
                required
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Data e hora</span>
              <input
                name="inicio"
                type="datetime-local"
                value={form.startsAt}
                required
                onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
              />
            </label>
          </div>
          <ChipInput
            label="Participantes"
            name="participantes"
            value={form.participants}
            onChange={(participants) => setForm({ ...form, participants })}
            placeholder="Nome e Enter"
          />
          <label className="field">
            <span>Pauta</span>
            <textarea name="pauta" value={form.agenda} rows={5} maxLength={20000} onChange={(event) => setForm({ ...form, agenda: event.target.value })} />
          </label>
          <label className="field">
            <span>Notas</span>
            <textarea name="notas" value={form.notes} rows={6} maxLength={20000} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Decisões</h2>
          </div>
          <div className="stack">
            {form.decisions.map((decision, index) => (
              <div className="line-row" key={decision.key}>
                <label className="field grow">
                  <span className="sr-only">Decisão {index + 1}</span>
                  <input
                    name={`decisao-${index + 1}`}
                    value={decision.content}
                    maxLength={1000}
                    placeholder="O que ficou decidido"
                    onChange={(event) =>
                      setForm({
                        ...form,
                        decisions: form.decisions.map((item) =>
                          item.key === decision.key ? { ...item, content: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setForm({ ...form, decisions: form.decisions.filter((item) => item.key !== decision.key) })}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => setForm({ ...form, decisions: [...form.decisions, { key: crypto.randomUUID(), content: '' }] })}
          >
            Adicionar decisão
          </button>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Itens de ação</h2>
          </div>
          <p className="help">
            Ao salvar, cada item gera uma tarefa. Remover o item da ata mantém a tarefa na lista, só desfaz o vínculo.
            A exportação usa a última versão salva.
          </p>
          <div className="stack">
            {form.actionItems.map((item, index) => (
              <div className="action-block" key={item.key}>
                <div className="action-row">
                  <label className="field">
                    <span>Item {index + 1}</span>
                    <input
                      name={`acao-${index + 1}`}
                      value={item.content}
                      maxLength={180}
                      placeholder="O que precisa ser feito"
                      onChange={(event) => updateAction(item.key, { content: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Responsável</span>
                    <input
                      name={`responsavel-${index + 1}`}
                      value={item.assignee}
                      maxLength={120}
                      onChange={(event) => updateAction(item.key, { assignee: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Prazo</span>
                    <input name={`prazo-${index + 1}`} type="date" value={item.dueDate} onChange={(event) => updateAction(item.key, { dueDate: event.target.value })} />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        actionItems: current.actionItems.filter((row) => row.key !== item.key),
                      }))
                    }
                  >
                    Remover
                  </button>
                </div>
                {item.task ? (
                  <div className="action-status">
                    <label>
                      <span className="sr-only">Status de {item.content || `item ${index + 1}`}</span>
                      <select
                        name={`status-${index + 1}`}
                        value={item.task.status}
                        disabled={pendingStatus === item.task.id}
                        onChange={(event) => void changeStatus(item.task!.id, event.target.value as Status)}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Link to={`/tarefas/${item.task.id}`}>Abrir tarefa</Link>
                  </div>
                ) : item.id ? (
                  <p className="help">A tarefa foi excluída. Salvar a ata cria outra.</p>
                ) : null}
              </div>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => setForm({ ...form, actionItems: [...form.actionItems, blankAction()] })}>
            Adicionar item de ação
          </button>
        </section>

        {!isNew && (
          <div className="form-actions">
            <button type="button" className="btn danger" onClick={() => setConfirming(true)} disabled={busy}>
              Excluir ata
            </button>
          </div>
        )}
      </form>

      {confirming && (
        <ConfirmDialog
          title="Excluir ata"
          message="A ata, as decisões e os itens de ação saem da lista. As tarefas geradas permanecem, sem o vínculo com a reunião."
          confirmLabel="Excluir ata"
          busy={busy}
          onClose={() => setConfirming(false)}
          onConfirm={() => void removeMeeting()}
        />
      )}
    </div>
  )
}
