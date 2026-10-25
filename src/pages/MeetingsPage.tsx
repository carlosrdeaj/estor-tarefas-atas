import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { MeetingSummary } from '../../shared/types'
import { api } from '../api'
import { actionSummary, formatDateTimePt } from '../format'

export function MeetingsPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const participant = params.get('participant') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const [qInput, setQInput] = useState(q)
  const [participantInput, setParticipantInput] = useState(participant)
  const [meetings, setMeetings] = useState<MeetingSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Reuniões · Pauta'
  }, [])

  useEffect(() => {
    setQInput(q)
  }, [q])

  useEffect(() => {
    setParticipantInput(participant)
  }, [participant])

  useEffect(() => {
    if (qInput === q && participantInput === participant) return
    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (qInput) next.set('q', qInput)
      else next.delete('q')
      if (participantInput) next.set('participant', participantInput)
      else next.delete('participant')
      setParams(next, { replace: true })
    }, 250)
    return () => window.clearTimeout(handle)
  }, [qInput, participantInput, q, participant, params, setParams])

  useEffect(() => {
    let cancelled = false
    api
      .listMeetings({
        q: q || undefined,
        participant: participant || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then((response) => {
        if (cancelled) return
        setMeetings(response)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as reuniões.')
      })
    return () => {
      cancelled = true
    }
  }, [q, participant, from, to])

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const filtersActive = Boolean(q || participant || from || to)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Atas</p>
          <h1>Reuniões</h1>
          <p className="lede">Guarde a pauta, as decisões e transforme cada item de ação em tarefa.</p>
        </div>
        <Link className="btn primary" to="/reunioes/nova">
          Nova ata
        </Link>
      </header>

      {error && (
        <p className="banner" role="alert">
          {error}
        </p>
      )}

      <div className="filters">
        <label className="field grow">
          <span>Busca</span>
          <input
            name="busca"
            type="search"
            value={qInput}
            placeholder="Título, pauta, notas, decisão ou participante"
            onChange={(event) => setQInput(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Participante</span>
          <input
            name="participante"
            value={participantInput}
            placeholder="Nome"
            onChange={(event) => setParticipantInput(event.target.value)}
          />
        </label>
        <label className="field">
          <span>De</span>
          <input name="de" type="date" value={from} onChange={(event) => updateFilter('from', event.target.value)} />
        </label>
        <label className="field">
          <span>Até</span>
          <input name="ate" type="date" value={to} onChange={(event) => updateFilter('to', event.target.value)} />
        </label>
        {filtersActive && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setParams({}, { replace: true })
              setQInput('')
              setParticipantInput('')
            }}
          >
            Limpar
          </button>
        )}
      </div>

      {meetings == null && !error && <p className="loading">Carregando reuniões…</p>}
      {meetings && meetings.length === 0 && (
        <div className="empty">
          <h2>Nenhuma ata encontrada</h2>
          <p>{filtersActive ? 'Nada corresponde a essa busca.' : 'Registre a próxima conversa para não perder a decisão.'}</p>
        </div>
      )}
      {meetings && meetings.length > 0 && (
        <ul className="meeting-list">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <Link className="meeting-card" to={`/reunioes/${meeting.id}`}>
                <div>
                  <h2>{meeting.title}</h2>
                  <p>{formatDateTimePt(meeting.startsAt)}</p>
                </div>
                <p className="meta">{meeting.participants.join(', ') || 'Sem participantes'}</p>
                <p className="meta">{actionSummary(meeting.actionTotal, meeting.actionDone)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
