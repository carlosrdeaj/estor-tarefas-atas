import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { actionSummary, formatDateTime, participantPreview } from "../../shared/format";
import type { MeetingSummary } from "../../shared/types";
import { Banner } from "../components/Modal";
import { useFetch } from "../useFetch";
import { useTitle } from "../useTitle";

export function MeetingsPage() {
  useTitle("Atas");
  const [q, setQ] = useState("");
  const [participant, setParticipant] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState({ q: "", participant: "", from: "", to: "" });

  useEffect(() => {
    const handle = window.setTimeout(() => setQuery({ q, participant, from, to }), 250);
    return () => window.clearTimeout(handle);
  }, [q, participant, from, to]);

  const params = new URLSearchParams();
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.participant.trim()) params.set("participant", query.participant.trim());
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const { data, error, loading } = useFetch<{ meetings: MeetingSummary[] }>(`/api/meetings?${params.toString()}`);
  const filtersActive = Boolean(q || participant || from || to);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Atas</p>
          <h1>Reuniões e o que ficou decidido</h1>
        </div>
        <Link className="btn primary" to="/reunioes/nova">
          Nova ata
        </Link>
      </header>
      {error && <Banner>{error}</Banner>}
      <div className="toolbar">
        <label className="field grow">
          <span className="sr-only">Buscar nas atas</span>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar em título, pauta, notas ou decisões" />
        </label>
        <label className="field">
          <span className="sr-only">Participante</span>
          <input value={participant} onChange={(event) => setParticipant(event.target.value)} placeholder="Participante" />
        </label>
        <label className="field">
          <span className="sr-only">De</span>
          <input type="date" aria-label="De" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          <span className="sr-only">Até</span>
          <input type="date" aria-label="Até" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        {filtersActive && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setQ("");
              setParticipant("");
              setFrom("");
              setTo("");
            }}
          >
            Limpar
          </button>
        )}
      </div>
      {loading && !data && <p className="muted">Carregando atas…</p>}
      {data && data.meetings.length === 0 && (
        <div className="empty">
          <p>{filtersActive ? "Nenhuma ata encontrada." : "Registre a primeira reunião para transformar decisões em tarefas."}</p>
          {!filtersActive && (
            <Link className="btn primary" to="/reunioes/nova">
              Nova ata
            </Link>
          )}
        </div>
      )}
      {data && data.meetings.length > 0 && (
        <div className="meeting-list">
          {data.meetings.map((meeting) => (
            <Link key={meeting.id} to={`/reunioes/${meeting.id}`} className="meeting-card">
              <div>
                <time dateTime={meeting.startsAt}>{formatDateTime(meeting.startsAt)}</time>
                <strong>{meeting.title}</strong>
                <p className="muted">{participantPreview(meeting.participants)}</p>
                {meeting.agendaPreview && <p className="clamp">{meeting.agendaPreview}</p>}
              </div>
              <span>{actionSummary(meeting.openActionItems, meeting.totalActionItems)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
