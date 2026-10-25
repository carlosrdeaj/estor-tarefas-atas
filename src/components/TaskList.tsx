import { Link } from "react-router-dom";
import { formatDate } from "../../shared/format";
import { PRIORITY_LABEL, STATUS_LABEL } from "../../shared/labels";
import { STATUSES, type Status, type Task } from "../../shared/types";

export function TaskList({
  tasks,
  onOpen,
  onStatus,
  savingId,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onStatus: (task: Task, status: Status) => void;
  savingId: string | null;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="task-list">
      {tasks.map((task) => (
        <article key={task.id} className={`task-row ${task.overdue ? "is-overdue" : ""} ${task.dueToday ? "is-today" : ""}`} data-priority={task.priority}>
          <div className="task-main">
            <button type="button" className="text-button" onClick={() => onOpen(task)}>
              {task.title}
            </button>
            <div className="flags">
              {task.overdue && <span className="flag overdue">Atrasada</span>}
              {task.dueToday && <span className="flag today">Hoje</span>}
              <span className={`priority ${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
            </div>
            {task.description && <p className="clamp">{task.description}</p>}
            {task.meetingId && (
              <Link to={`/reunioes/${task.meetingId}`} className="origin-link">
                Ata: {task.meetingTitle}
              </Link>
            )}
            {task.tags.length > 0 && (
              <div className="tag-row">
                {task.tags.map((tag) => (
                  <span key={tag} className="chip quiet">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <label className="field compact">
            <span className="sr-only">Status de {task.title}</span>
            <select value={task.status} disabled={savingId === task.id} onChange={(event) => onStatus(task, event.target.value as Status)}>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          <div className="task-meta">
            <span>{formatDate(task.dueDate)}</span>
            <span>{task.assignee || "Sem responsável"}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
