import { Link } from "react-router-dom";
import { actionSummary, formatDate, formatDateTime, formatLongDate, greeting, participantPreview } from "../../shared/format";
import { PRIORITY_LABEL } from "../../shared/labels";
import type { Dashboard } from "../../shared/types";
import { Banner } from "../components/Modal";
import { useFetch } from "../useFetch";
import { useTitle } from "../useTitle";

export function DashboardPage() {
  useTitle("Painel");
  const { data, error, loading } = useFetch<Dashboard>("/api/dashboard");

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1>{data ? formatLongDate(data.today) : "Seu dia"}</h1>
          <p className="lede">O que vence hoje, o que ficou para trás e as atas mais recentes.</p>
        </div>
        <div className="row-actions">
          <Link className="btn" to="/tarefas">
            Ver tarefas
          </Link>
          <Link className="btn primary" to="/reunioes/nova">
            Nova ata
          </Link>
        </div>
      </header>
      {error && <Banner>{error}</Banner>}
      {loading && !data && <p className="muted">Carregando o painel…</p>}
      {data && (
        <>
          <section className="stats" aria-label="Contadores">
            <Link to="/tarefas?status=todo" className="stat">
              <span>A fazer</span>
              <strong>{data.counts.todo}</strong>
            </Link>
            <Link to="/tarefas?status=in_progress" className="stat">
              <span>Em andamento</span>
              <strong>{data.counts.in_progress}</strong>
            </Link>
            <Link to="/tarefas?status=done" className="stat">
              <span>Concluída</span>
              <strong>{data.counts.done}</strong>
            </Link>
            <Link to="/tarefas?due=atrasadas" className="stat alert">
              <span>Atrasadas</span>
              <strong>{data.overdue.length}</strong>
            </Link>
          </section>
          <div className="split">
            <section className="panel">
              <div className="panel-head">
                <h2>Para hoje</h2>
                <Link to="/tarefas?due=hoje">Ver todas</Link>
              </div>
              <TaskStack tasks={data.dueToday} empty="Nada com prazo para hoje." />
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2>Atrasadas</h2>
                <Link to="/tarefas?due=atrasadas">Ver todas</Link>
              </div>
              <TaskStack tasks={data.overdue} empty="Nenhuma tarefa atrasada." />
            </section>
          </div>
          <section className="panel">
            <div className="panel-head">
              <h2>Últimas atas</h2>
              <Link to="/reunioes">Ver todas</Link>
            </div>
            {data.recentMeetings.length === 0 ? (
              <div className="empty">
                <p>As atas das suas reuniões aparecem aqui.</p>
                <Link className="btn primary" to="/reunioes/nova">
                  Registrar uma reunião
                </Link>
              </div>
            ) : (
              <div className="meeting-list">
                {data.recentMeetings.map((meeting) => (
                  <Link key={meeting.id} to={`/reunioes/${meeting.id}`} className="meeting-card">
                    <div>
                      <strong>{meeting.title}</strong>
                      <p>{formatDateTime(meeting.startsAt)}</p>
                      <p className="muted">{participantPreview(meeting.participants)}</p>
                    </div>
                    <span>{actionSummary(meeting.openActionItems, meeting.totalActionItems)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TaskStack({ tasks, empty }: { tasks: Dashboard["dueToday"]; empty: string }) {
  if (tasks.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="stack">
      {tasks.map((task) => (
        <Link key={task.id} to={`/tarefas?tarefa=${task.id}`} className={`mini-task ${task.overdue ? "is-overdue" : ""} ${task.dueToday ? "is-today" : ""}`}>
          <span>
            <strong>{task.title}</strong>
            <small>
              {PRIORITY_LABEL[task.priority]} · {formatDate(task.dueDate)}
              {task.assignee ? ` · ${task.assignee}` : ""}
            </small>
          </span>
          {task.overdue && <em>Atrasada</em>}
          {task.dueToday && <em>Hoje</em>}
        </Link>
      ))}
    </div>
  );
}
