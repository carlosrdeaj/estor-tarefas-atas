import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { filterTasks, sortTasksForList } from "../../shared/filterTasks";
import { PRIORITY_LABEL, STATUS_LABEL, isPriority, isStatus } from "../../shared/labels";
import { DUE_FILTERS, PRIORITIES, STATUSES, type ReorderItem, type Status, type Task, type TaskFilter } from "../../shared/types";
import { api } from "../api";
import { Banner } from "../components/Modal";
import { KanbanBoard } from "../components/KanbanBoard";
import { TaskDialog } from "../components/TaskDialog";
import { TaskList } from "../components/TaskList";
import { useFetch } from "../useFetch";
import { useTitle } from "../useTitle";

type TaskResponse = { today: string; tags: string[]; tasks: Task[] };

const dueLabels: Record<(typeof DUE_FILTERS)[number], string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  semana: "Próximos 7 dias",
  "sem-prazo": "Sem prazo",
};

function readFilter(params: URLSearchParams): TaskFilter {
  const status = params.get("status") ?? "";
  const priority = params.get("priority") ?? "";
  const due = params.get("due") ?? "";
  return {
    q: params.get("q") ?? "",
    status: isStatus(status) ? status : "",
    priority: isPriority(priority) ? priority : "",
    due: due === "atrasadas" || due === "hoje" || due === "semana" || due === "sem-prazo" ? due : "",
    tag: params.get("tag") ?? "",
  };
}

export function TasksPage() {
  useTitle("Tarefas");
  const [params, setParams] = useSearchParams();
  const filter = useMemo(() => readFilter(params), [params]);
  const [q, setQ] = useState(filter.q ?? "");
  const [view, setView] = useState<"lista" | "quadro">(() => (sessionStorage.getItem("nexo-view") === "quadro" ? "quadro" : "lista"));
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const openedRef = useRef<string | null>(null);
  const { data, setData, error, loading, reload } = useFetch<TaskResponse>("/api/tasks");

  useEffect(() => {
    setQ(filter.q ?? "");
  }, [filter.q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (q.trim() === (filter.q ?? "")) return;
      write({ q: q.trim() });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [q, filter.q, params]);

  useEffect(() => {
    const id = params.get("tarefa");
    if (!id || !data) return;
    if (openedRef.current === id) return;
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    openedRef.current = id;
    setEditing(task);
  }, [params, data]);

  function write(partial: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(partial)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  const visible = useMemo(() => {
    if (!data) return [];
    return sortTasksForList(filterTasks(data.tasks, { ...filter, q }, data.today));
  }, [data, filter, q]);

  const filtersActive = Boolean(filter.status || filter.priority || filter.due || filter.tag || q.trim());

  function switchView(next: "lista" | "quadro") {
    setView(next);
    sessionStorage.setItem("nexo-view", next);
  }

  function openTask(task: Task) {
    openedRef.current = task.id;
    setEditing(task);
    write({ tarefa: task.id });
  }

  function closeDialog() {
    setEditing(null);
    write({ tarefa: "" });
  }

  async function changeStatus(task: Task, status: Status) {
    setSavingId(task.id);
    setActionError(null);
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Não foi possível atualizar o status.");
    } finally {
      setSavingId(null);
    }
  }

  async function move(tasks: Task[], changed: ReorderItem[]) {
    if (!data) return;
    const previous = data;
    setData({ ...data, tasks });
    setActionError(null);
    try {
      await api("/api/tasks/reorder", { method: "POST", body: JSON.stringify({ items: changed }) });
    } catch (reason) {
      setData(previous);
      setActionError(reason instanceof Error ? reason.message : "Não foi possível mover a tarefa.");
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Tarefas</p>
          <h1>O que precisa andar</h1>
        </div>
        <button type="button" className="btn primary" onClick={() => setEditing("new")}>
          Nova tarefa
        </button>
      </header>
      {(error || actionError) && <Banner>{error || actionError}</Banner>}
      <div className="toolbar">
        <label className="field grow">
          <span className="sr-only">Buscar tarefas</span>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por título, pessoa, tag ou ata" />
        </label>
        <Select label="Status" value={filter.status ?? ""} onChange={(status) => write({ status })}>
          <option value="">Todos os status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
        <Select label="Prioridade" value={filter.priority ?? ""} onChange={(priority) => write({ priority })}>
          <option value="">Todas as prioridades</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABEL[priority]}
            </option>
          ))}
        </Select>
        <Select label="Prazo" value={filter.due ?? ""} onChange={(due) => write({ due })}>
          <option value="">Todos os prazos</option>
          {DUE_FILTERS.map((due) => (
            <option key={due} value={due}>
              {dueLabels[due]}
            </option>
          ))}
        </Select>
        <Select label="Tag" value={filter.tag ?? ""} onChange={(tag) => write({ tag })}>
          <option value="">Todas as tags</option>
          {(data?.tags ?? []).map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </Select>
        {filtersActive && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setQ("");
              const next = new URLSearchParams();
              const taskId = params.get("tarefa");
              if (taskId) next.set("tarefa", taskId);
              setParams(next, { replace: true });
            }}
          >
            Limpar
          </button>
        )}
        <div className="segmented" role="group" aria-label="Visualização">
          <button type="button" className={view === "lista" ? "active" : ""} onClick={() => switchView("lista")}>
            Lista
          </button>
          <button type="button" className={view === "quadro" ? "active" : ""} onClick={() => switchView("quadro")}>
            Quadro
          </button>
        </div>
      </div>
      {loading && !data && <p className="muted">Carregando tarefas…</p>}
      {data && data.tasks.length === 0 && (
        <div className="empty">
          <p>Você ainda não tem tarefas.</p>
          <button type="button" className="btn primary" onClick={() => setEditing("new")}>
            Criar a primeira
          </button>
        </div>
      )}
      {data && data.tasks.length > 0 && visible.length === 0 && (
        <div className="empty">
          <p>Nenhuma tarefa com esses filtros.</p>
        </div>
      )}
      {data && visible.length > 0 && view === "lista" && <TaskList tasks={visible} onOpen={openTask} onStatus={changeStatus} savingId={savingId} />}
      {data && visible.length > 0 && view === "quadro" && (
        <>
          <p className="hint">Arraste pelo ícone ⠿ para mudar a coluna ou a ordem.</p>
          <KanbanBoard visible={visible} allTasks={data.tasks} onOpen={openTask} onMove={move} />
        </>
      )}
      {editing && (
        <TaskDialog
          task={editing === "new" ? null : editing}
          onClose={closeDialog}
          onSaved={() => {
            closeDialog();
            reload();
          }}
        />
      )}
    </div>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="field">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}
