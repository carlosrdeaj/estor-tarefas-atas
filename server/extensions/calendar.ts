export type CalendarEvent = {
  title: string;
  startsAt: string;
  attendees: string[];
};

/**
 * Ponto de extensão para calendário (Outlook ou outro).
 * Registre um conector com `registerCalendarConnector`.
 * Sem conector, GET /api/calendar/upcoming responde 501.
 */
export interface CalendarConnector {
  name: string;
  listUpcoming(): Promise<CalendarEvent[]>;
}

let connector: CalendarConnector | null = null;

export function registerCalendarConnector(implementation: CalendarConnector) {
  connector = implementation;
}

export function getCalendarConnector() {
  return connector;
}
