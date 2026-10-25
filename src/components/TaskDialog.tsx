import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type Priority, type Status, type Task, type TaskInput } from '../../shared/types'
import { ChipInput } from './ChipInput'
import { ConfirmDialog, Modal } from './Modal'

type TaskDialogProps = {
  task: Task | null
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (input: TaskInput) => Promise<void>
  onDelete: () => Promise<void>
}

export function TaskDialog({ task, busy, error, onClose, onSave, onDelete }: TaskDialogProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<Status>(task?.status ?? 'todo')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [assignee, setAssignee] = useState(task?.assignee ?? '')
  const [tags, setTags] = useState<string[]>(task?.tags ?? [])
  const [confirming, setConfirming] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setLocalError('Informe o título.')
      return
    }
    setLocalError(null)
    await onSave({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      dueDate: dueDate || null,
      assignee: assignee.trim(),
      tags,
    })
  }

  return (
    <>
      <Modal title={task ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose} wide>
        <form onSubmit={submit}>
          {(localError || error) && (
            <p className="banner" role="alert">
              {localError || error}
            </p>
          )}
          {task?.meeting && (
            <p className="origin-block">
              Originada da ata <Link to={`/reunioes/${task.meeting.id}`}>{task.meeting.title}</Link>
            </p>
          )}
          <label className="field">
            <span>Título</span>
            <input name="titulo" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} required />
          </label>
          <label className="field">
            <span>Descrição</span>
            <textarea name="descricao" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={8000} rows={4} />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Status</span>
              <select name="status" value={status} onChange={(event) => setStatus(event.target.value as Status)}>
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {STATUS_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Prioridade</span>
              <select name="prioridade" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                {PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {PRIORITY_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Prazo</span>
              <input name="prazo" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label className="field">
              <span>Responsável</span>
              <input name="responsavel" value={assignee} onChange={(event) => setAssignee(event.target.value)} maxLength={120} placeholder="Quem vai fazer" />
            </label>
          </div>
          <ChipInput label="Etiquetas" name="etiquetas" value={tags} onChange={setTags} placeholder="Ex.: trabalho, casa" />
          <div className="form-actions spread">
            {task ? (
              <button type="button" className="btn danger" onClick={() => setConfirming(true)} disabled={busy}>
                Excluir
              </button>
            ) : (
              <span />
            )}
            <div className="form-actions">
              <button type="button" className="btn" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar tarefa'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
      {confirming && task && (
        <ConfirmDialog
          title="Excluir tarefa"
          message={`A tarefa “${task.title}” sai da lista. Se ela veio de uma ata, o item de ação continua lá, sem tarefa vinculada.`}
          confirmLabel="Excluir tarefa"
          busy={busy}
          onClose={() => setConfirming(false)}
          onConfirm={() => void onDelete()}
        />
      )}
    </>
  )
}
