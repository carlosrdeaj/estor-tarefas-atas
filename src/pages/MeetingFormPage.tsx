import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { MeetingDetail, Priority } from "../../shared/types";
import { PRIORITIES } from "../../shared/types";
import { PRIORITY_LABEL } from "../../shared/labels";
import { api } from "../api";
import { Banner } from "../components/Modal";
import { ChipInput } from "../components/ChipInput";
import { useFetch } from "../useFetch";
import { useTitle } from "../useTitle";

type DraftDecision = { key: string; content: string };
type DraftAction = { key: string; id?: string; title: string; assignee: string; dueDate: string; priority: Priority };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function defaultDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function defaultTime() {
  const now = new Date();
  return `${pad((now.getHours() + 1) % 24)}:00`;
}

function blankAction(): DraftAction {
  return { key: crypto.randomUUID(), title: "", assignee: "", dueDate: "", priority: "medium" };
}

export function MeetingFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  useTitle(isEdit ? "Editar ata" : "Nova ata");
  const { data, error: loadError, loading } = useFetch<MeetingDetail>(id ? `/api/meetings/${id}` : null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [participants, setParticipants] = useState<string[]>([]);
  const [agenda, setAgenda] = useState("");
  const [notes, setNotes] = useState("");
  const [decisions, setDecisions] = useState<DraftDecision[]>([{ key: crypto.randomUUID(), content: "" }]);
  const [actions, setActions] = useState<DraftAction[]>([blankAction()]);
  const [ready, setReady] = useState(!id);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data || ready) return;
    setTitle(data.title);
    setDate(data.startsAt.slice(0, 10));
    setTime(data.startsAt.slice(11, 16));
    setParticipants(data.participants);
    setAgenda(data.agenda);
    setNotes(data.notes);
    setDecisions(data.decisions.length ? data.decisions.map((item) => ({ key: item.id, content: item.content })) : [{ key: crypto.randomUUID(), content: "" }]);
    setActions(
      data.actionItems.length
        ? data.actionItems.map((item) => ({
            key: item.id,
            id: item.id,
            title: item.title,
            assignee: item.assignee,
            dueDate: item.dueDate ?? "",
            priority: item.priority,
          }))
        : [blankAction()],
    );
    setReady(true);
  }, [data, ready]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Informe um título.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      setError("Informe data e hora.");
      return;
    }
    const filledActions = actions.filter((item) => item.title.trim() || item.assignee.trim() || item.dueDate);
    if (filledActions.some((item) => !item.title.trim())) {
      setError("Informe o texto de cada item de ação.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: title.trim(),
      startsAt: `${date}T${time}`,
      participants,
      agenda,
      notes,
      decisions: decisions.map((item) => item.content.trim()).filter(Boolean),
      actionItems: filledActions.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        title: item.title.trim(),
        assignee: item.assignee.trim(),
        dueDate: item.dueDate || null,
        priority: item.priority,
      })),
    };
    try {
      const saved = await api<MeetingDetail>(id ? `/api/meetings/${id}` : "/api/meetings", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      navigate(`/reunioes/${saved.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a ata.");
      setSaving(false);
    }
  }

  function updateAction(key: string, patch: Partial<DraftAction>) {
    setActions((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  if (id && loading && !ready) return <p className="muted">Carregando ata…</p>;
  if (loadError) return <Banner>{loadError}</Banner>;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Ata</p>
          <h1>{isEdit ? "Editar reunião" : "Nova reunião"}</h1>
        </div>
      </header>
      <form className="sheet" onSubmit={save}>
        {error && <Banner>{error}</Banner>}
        <div className="form-grid">
          <label className="field span-2">
            <span>Título</span>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
          </label>
          <label className="field">
            <span>Data</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Hora</span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value.slice(0, 5))} />
          </label>
        </div>
        <ChipInput label="Participantes" values={participants} onChange={setParticipants} placeholder="Nome e Enter" />
        <label className="field">
          <span>Pauta</span>
          <textarea value={agenda} onChange={(event) => setAgenda(event.target.value)} rows={5} placeholder="Assuntos a tratar" />
        </label>
        <label className="field">
          <span>Notas</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} placeholder="O que foi discutido" />
        </label>
        <fieldset className="repeat">
          <legend>Decisões</legend>
          {decisions.map((decision, index) => (
            <div className="repeat-row" key={decision.key}>
              <input
                aria-label={`Decisão ${index + 1}`}
                value={decision.content}
                onChange={(event) => setDecisions(decisions.map((item) => (item.key === decision.key ? { ...item, content: event.target.value } : item)))}
              />
              <button type="button" className="btn" onClick={() => setDecisions(decisions.filter((item) => item.key !== decision.key))} aria-label={`Remover decisão ${index + 1}`}>
                Remover
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => setDecisions([...decisions, { key: crypto.randomUUID(), content: "" }])}>
            Adicionar decisão
          </button>
        </fieldset>
        <fieldset className="repeat">
          <legend>Itens de ação</legend>
          <p className="hint">Cada item vira uma tarefa ligada a esta ata. Remover um item também exclui a tarefa. O status continua sendo atualizado na lista de tarefas.</p>
          {actions.map((action, index) => (
            <div className="action-row" key={action.key}>
              <input
                aria-label={`Item de ação ${index + 1}`}
                placeholder="O que precisa ser feito"
                value={action.title}
                onChange={(event) => updateAction(action.key, { title: event.target.value })}
              />
              <input
                aria-label={`Responsável do item ${index + 1}`}
                placeholder="Responsável"
                value={action.assignee}
                onChange={(event) => updateAction(action.key, { assignee: event.target.value })}
              />
              <input aria-label={`Prazo do item ${index + 1}`} type="date" value={action.dueDate} onChange={(event) => updateAction(action.key, { dueDate: event.target.value })} />
              <select aria-label={`Prioridade do item ${index + 1}`} value={action.priority} onChange={(event) => updateAction(action.key, { priority: event.target.value as Priority })}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </select>
              <button type="button" className="btn" onClick={() => setActions(actions.filter((item) => item.key !== action.key))}>
                Remover
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => setActions([...actions, blankAction()])}>
            Adicionar item
          </button>
        </fieldset>
        <div className="row-actions">
          <Link className="btn" to={id ? `/reunioes/${id}` : "/reunioes"}>
            Cancelar
          </Link>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Salvando…" : "Salvar ata"}
          </button>
        </div>
      </form>
    </div>
  );
}
