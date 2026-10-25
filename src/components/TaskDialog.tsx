import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Priority, Status, Task } from "../../shared/types";
import { PRIORITY_LABEL, STATUS_LABEL } from "../../shared/labels";
import { PRIORITIES, STATUSES } from "../../shared/types";
import { api } from "../api";
import { Banner, Modal } from "./Modal";
import { ChipInput } from "./ChipInput";

const empty = {
  title: "",
  description: "",
  status: "todo" as Status,
  priority: "medium" as Priority,
  dueDate: "",
  assignee: "",
  tags: [] as string[],
};

export function TaskDialog({ task, onClose, onSaved }: { task: Task | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(() =>
    task
      ? {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate ?? "",
          assignee: task.assignee,
          tags: task.tags,
        }
      : empty,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Informe um título.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      assignee: form.assignee.trim(),
      tags: form.tags,
    };
    try {
      if (task) await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
      setSaving(false);
    }
  }

  async function remove() {
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir.");
      setSaving(false);
    }
  }

  return (
    <Modal title={task ? "Editar tarefa" : "Nova tarefa"} onClose={onClose}>
      <form className="stack-form" onSubmit={save}>
        {error && <Banner>{error}</Banner>}
        {task?.meetingId && (
          <p className="origin">
            Originada da ata <Link to={`/reunioes/${task.meetingId}`}>{task.meetingTitle || "reunião"}</Link>
          </p>
        )}
        <label className="field">
          <span>Título</span>
          <input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} />
        </label>
        <label className="field">
          <span>Descrição</span>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Prioridade</span>
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABEL[priority]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Prazo</span>
            <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          </label>
          <label className="field">
            <span>Responsável</span>
            <input value={form.assignee} onChange={(event) => setForm({ ...form, assignee: event.target.value })} maxLength={120} placeholder="Nome" />
          </label>
        </div>
        <ChipInput label="Tags" values={form.tags} onChange={(tags) => setForm({ ...form, tags })} placeholder="ex.: pessoal, urgente" />
        {confirming ? (
          <div className="confirm">
            <p>Excluir esta tarefa? Essa ação não pode ser desfeita.</p>
            <div className="row-actions">
              <button type="button" className="btn danger" onClick={remove} disabled={saving}>
                Excluir
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="row-actions spread">
            {task ? (
              <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
                Excluir
              </button>
            ) : (
              <span />
            )}
            <div className="row-actions">
              <button type="button" className="btn" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "Salvando…" : task ? "Salvar" : "Criar tarefa"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
