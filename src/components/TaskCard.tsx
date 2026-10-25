import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PRIORITY_LABEL, STATUS_LABEL, type Task } from '../../shared/types'
import { cx, dueHint, taskFlags } from '../format'

type TaskCardProps = {
  task: Task
  today: string
  href: string
  showExcerpt?: boolean
  dragging?: boolean
  overlay?: boolean
  handle?: ReactNode
  setNodeRef?: (element: HTMLElement | null) => void
  dragProps?: HTMLAttributes<HTMLElement>
}

export function TaskCard({ task, today, href, showExcerpt, dragging, overlay, handle, setNodeRef, dragProps }: TaskCardProps) {
  const flags = taskFlags(task, today)
  const hint = dueHint(task.dueDate, today)
  return (
    <article
      ref={setNodeRef}
      {...dragProps}
      className={cx(
        'task-card',
        `prio-${task.priority}`,
        flags.overdue && 'is-overdue',
        flags.dueToday && 'is-today',
        task.status === 'done' && 'is-done',
        dragging && 'is-dragging',
        overlay && 'is-overlay',
      )}
    >
      {handle}
      <div className="card-main">
        <div className="card-top">
          <h3>
            {overlay ? task.title : (
              <Link to={href} draggable={false}>
                {task.title}
              </Link>
            )}
          </h3>
          <span className={`badge status-${task.status}`}>{STATUS_LABEL[task.status]}</span>
        </div>
        <div className="flag-row">
          <span className={`prio prio-${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
          {flags.overdue && <span className="flag overdue">Atrasada</span>}
          {flags.dueToday && <span className="flag today">Hoje</span>}
          {hint && !flags.dueToday && <span className="flag quiet">{hint}</span>}
        </div>
        {showExcerpt && task.description && <p className="excerpt">{task.description}</p>}
        <p className="meta">{task.assignee || 'Sem responsável'}</p>
        {task.tags.length > 0 && (
          <ul className="tag-list">
            {task.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
        {task.meeting &&
          (overlay ? (
            <p className="origin">Ata: {task.meeting.title}</p>
          ) : (
            <Link className="origin" to={`/reunioes/${task.meeting.id}`} draggable={false}>
              Ata: {task.meeting.title}
            </Link>
          ))}
      </div>
    </article>
  )
}
