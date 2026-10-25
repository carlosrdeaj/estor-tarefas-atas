/**
 * Pontos de extensão deixados de fora do MVP.
 *
 * Resumo por IA: implemente MeetingSummaryProvider. O conteúdo estruturado
 * da ata (pauta, notas, decisões e itens de ação) já sai de getMeeting.
 * Uma rota nova, por exemplo POST /api/meetings/:id/summary, pode chamar
 * o provider sem mexer no restante do fluxo.
 *
 * Outlook: implemente CalendarImporter para listar eventos e transformá-los
 * em atas com createMeeting (título, horário e participantes). Não há login
 * nem chamadas de rede nesta versão.
 */

export type MeetingSummaryInput = {
  title: string
  agenda: string
  notes: string
  decisions: string[]
  actionItems: string[]
}

export interface MeetingSummaryProvider {
  summarize(input: MeetingSummaryInput): Promise<string>
}

export interface CalendarImporter {
  listUpcoming(): Promise<Array<{ title: string; startsAt: string; participants: string[] }>>
}

export const summaryProvider: MeetingSummaryProvider | null = null
export const calendarImporter: CalendarImporter | null = null
