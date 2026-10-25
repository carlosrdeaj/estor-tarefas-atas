import { formatDate, formatDateTime } from "../shared/format";
import { PRIORITY_LABEL, STATUS_LABEL } from "../shared/labels";
import type { MeetingDetail } from "../shared/types";

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

export function renderMeetingMarkdown(meeting: MeetingDetail): string {
  const participants = meeting.participants.length > 0 ? meeting.participants.join(", ") : "Não informados";
  const decisions = meeting.decisions.length
    ? meeting.decisions.map((decision, index) => `${index + 1}. ${decision.content}`).join("\n")
    : "_Nenhuma decisão registrada._";
  const actions = meeting.actionItems.length
    ? [
        "| Item | Responsável | Prazo | Prioridade | Status |",
        "| --- | --- | --- | --- | --- |",
        ...meeting.actionItems.map((item) =>
          `| ${cell(item.title)} | ${cell(item.assignee || "—")} | ${cell(formatDate(item.dueDate))} | ${PRIORITY_LABEL[item.priority]} | ${STATUS_LABEL[item.status]} |`,
        ),
      ].join("\n")
    : "_Nenhum item de ação._";

  return [
    `# ${meeting.title}`,
    "",
    `- **Quando:** ${formatDateTime(meeting.startsAt)}`,
    `- **Participantes:** ${participants}`,
    "",
    "## Pauta",
    "",
    meeting.agenda.trim() || "_Sem pauta._",
    "",
    "## Notas",
    "",
    meeting.notes.trim() || "_Sem notas._",
    "",
    "## Decisões",
    "",
    decisions,
    "",
    "## Itens de ação",
    "",
    actions,
    "",
    "_Gerado pelo Nexo._",
    "",
  ].join("\n");
}
