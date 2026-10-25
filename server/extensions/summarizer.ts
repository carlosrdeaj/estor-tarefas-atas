export type SummaryInput = {
  title: string;
  startsAt: string;
  participants: string[];
  agenda: string;
  notes: string;
  decisions: string[];
};

/**
 * Ponto de extensão para resumo por IA.
 * Registre uma implementação com `registerSummarizer` antes de servir o app
 * (ou a qualquer momento: a rota consulta o provedor a cada pedido).
 * Enquanto nada estiver registrado, POST /api/meetings/:id/summary responde 501.
 */
export interface MeetingSummarizer {
  name: string;
  summarize(input: SummaryInput): Promise<string>;
}

let summarizer: MeetingSummarizer | null = null;

export function registerSummarizer(implementation: MeetingSummarizer) {
  summarizer = implementation;
}

export function getSummarizer() {
  return summarizer;
}
