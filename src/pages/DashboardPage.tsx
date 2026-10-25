import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DashboardData } from '../../shared/types'
import { STATUS_LABEL } from '../../shared/types'
import { api } from '../api'
import { actionSummary, dueHint } from '../format'

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Painel · Pauta'
    let cancelled = false
    api
      .dashboard()
      .then((dashboard) => {
        if (!cancelled) setData(dashboard)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o painel.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="banner" role="alert">{error}</p>
  if (!data) return <p className="loading">Carregando o painel…</p>

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{data.dateLabel}</p>
          <h1>{data.greeting}.</h1>
          <p className="lede">O que pede atenção hoje, o que ficou para trás e as últimas atas.</p>
        </div>
        <div className="hero-actions">
          <Link className="btn primary" to="/tarefas?nova=1">
            Nova tarefa
          </Link>
          <Link className="btn" to="/reunioes/nova">
            Nova ata
          </Link>
        </div>
      </header>

      <section className="stats" aria-label="Resumo das tarefas">
        <Link className="stat" to="/tarefas?status=todo">
          <span>{STATUS_LABEL.todo}</span>
          <strong>{data.counts.todo}</strong>
        </Link>
        <Link className="stat" to="/tarefas?status=in_progress">
          <span>{STATUS_LABEL.in_progress}</span>
          <strong>{data.counts.in_progress}</strong>
        </Link>
        <Link className="stat" to="/tarefas?status=done">
          <span>{STATUS_LABEL.done}</span>
          <strong>{data.counts.done}</strong>
        </Link>
        <Link className="stat alert" to="/tarefas?due=overdue">
          <span>Atrasadas</span>
          <strong>{data.counts.overdue}</strong>
        </Link>
      </section>

      <div className="split">
        <section className="panel">
          <div className="panel-head">
            <h2>Para hoje</h2>
            <Link to="/tarefas?due=today">Ver todas</Link>
          </div>
          {data.todayTasks.length === 0 ? (
            <p className="empty-copy">Nada em aberto com prazo para hoje.</p>
          ) : (
            <ul className="plain-list">
              {data.todayTasks.map((task) => (
                <li key={task.id}>
                  <Link className="row-card is-today" to={`/tarefas/${task.id}`}>
                    <span>
                      <strong>{task.title}</strong>
                      <small>{task.assignee || 'Sem responsável'}</small>
                    </span>
                    <span className={`badge status-${task.status}`}>{STATUS_LABEL[task.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Atrasadas</h2>
            <Link to="/tarefas?due=overdue">Ver todas</Link>
          </div>
          {data.overdueTasks.length === 0 ? (
            <p className="empty-copy">Nenhuma tarefa em aberto passou do prazo.</p>
          ) : (
            <ul className="plain-list">
              {data.overdueTasks.map((task) => (
                <li key={task.id}>
                  <Link className="row-card is-overdue" to={`/tarefas/${task.id}`}>
                    <span>
                      <strong>{task.title}</strong>
                      <small>{dueHint(task.dueDate, data.today) ?? 'Atrasada'}</small>
                    </span>
                    <span className="flag overdue">Atrasada</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Últimas atas</h2>
          <Link to="/reunioes">Ver todas</Link>
        </div>
        {data.recentMeetings.length === 0 ? (
          <p className="empty-copy">Ainda não há reuniões registradas.</p>
        ) : (
          <ul className="plain-list">
            {data.recentMeetings.map((meeting) => (
              <li key={meeting.id}>
                <Link className="row-card" to={`/reunioes/${meeting.id}`}>
                  <span>
                    <strong>{meeting.title}</strong>
                    <small>
                      {meeting.participants.join(', ') || 'Sem participantes'} · {actionSummary(meeting.actionTotal, meeting.actionDone)}
                    </small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
