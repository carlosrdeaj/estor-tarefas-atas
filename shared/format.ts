export function formatDate(value: string | null | undefined): string {
  if (!value) return "Sem prazo";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function formatDateTime(value: string): string {
  const [date, time] = value.split("T");
  if (!time) return formatDate(date);
  return `${formatDate(date)} às ${time}`;
}

export function formatLongDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function participantPreview(names: string[]): string {
  if (names.length === 0) return "Sem participantes";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} e +${names.length - 3}`;
}

export function actionSummary(open: number, total: number): string {
  if (total === 0) return "Nenhum item de ação";
  if (open === 0) return total === 1 ? "1 item, concluído" : `${total} itens, todos concluídos`;
  return open === 1 ? "1 item em aberto" : `${open} itens em aberto`;
}
