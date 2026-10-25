import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDate, formatDateTime } from "../../shared/format";
import { PRIORITY_LABEL, STATUS_LABEL } from "../../shared/labels";
import type { MeetingDetail } from "../../shared/types";
import { api } from "../api";
import { Banner } from "../components/Modal";
import { useFetch } from "../useFetch";
import { useTitle } from "../useTitle";

export function MeetingDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useFetch<MeetingDetail>(id ? `/api/meetings/${id}` : null);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  useTitle(data?.title ?? "Ata");

  async function remove() {
    setRemoving(true);
    setActionError(null);
    try {
      await api(`/api/meetings/${id}`, { method: "DELETE" });
      navigate("/reunioes");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Não foi possível excluir.");
      setRemoving(false);
    }
  }

  if (loading && !data) return <p className="muted">Carregando ata…</p>;
  if (error) return <Banner>{error}</Banner>;
  if (!data) return null;

  const done = data.actionItems.filter((item) => item.status === "done").length;

  return (
    <article className="page sheet read">
      <header className="page-head">
        <div>
          <p className="eyebrow">Ata</p>
          <h1>{data.title}</h1>
          <p className="lede">{formatDateTime(data.startsAt)}</p>
        </div>
        <div className="row-actions">
          <a className="btn" href={`/api/meetings/${data.id}/export.md`}>
            Markdown
          </a>
          <a className="btn" href={`/api/meetings/${data.id}/export.pdf`}>
            PDF
          </a>
          <Link className="btn" to={`/reunioes/${data.id}/editar`}>
            Editar
          </Link>
        </div>
      </header>
      {actionError && <Banner>{actionError}</Banner>}
      <section>
        <h2>Participantes</h2>
        {data.participants.length === 0 ? (
          <p className="muted">Nenhum participante informado.</p>
        ) : (
          <div className="tag-row">
            {data.participants.map((name) => (
              <span key={name} className="chip quiet">
                {name}
              </span>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2>Pauta</h2>
        <p className="prose">{data.agenda.trim() || "Sem pauta."}</p>
      </section>
      <section>
        <h2>Notas</h2>
        <p className="prose">{data.notes.trim() || "Sem notas."}</p>
      </section>
      <section>
        <h2>Decisões</h2>
        {data.decisions.length === 0 ? (
          <p className="muted">Nenhuma decisão registrada.</p>
        ) : (
          <ol className="decisions">
            {data.decisions.map((decision) => (
              <li key={decision.id}>{decision.content}</li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <div className="panel-head">
          <h2>Itens de ação</h2>
          <span className="muted">
            {data.actionItems.length === 0 ? "Nenhum item" : `${done} de ${data.actionItems.length} concluídos`}
          </span>
        </div>
        {data.actionItems.length === 0 ? (
          <p className="muted">Nenhum item de ação.</p>
        ) : (
          <ul className="action-status">
            {data.actionItems.map((item) => (
              <li key={item.id}>
                <div>
                  <Link to={`/tarefas?tarefa=${item.id}`}>{item.title}</Link>
                  <p className="muted">
                    {item.assignee || "Sem responsável"} · {formatDate(item.dueDate)} · {PRIORITY_LABEL[item.priority]}
                  </p>
                </div>
                <span className={`status ${item.status}`}>{STATUS_LABEL[item.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirming ? (
        <div className="confirm">
          <p>Excluir esta ata? As tarefas criadas a partir dela permanecem, sem o vínculo com a reunião.</p>
          <div className="row-actions">
            <button type="button" className="btn danger" onClick={remove} disabled={removing}>
              {removing ? "Excluindo…" : "Excluir ata"}
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
          Excluir ata
        </button>
      )}
    </article>
  );
}
