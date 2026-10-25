import PDFDocument from "pdfkit";
import { formatDate, formatDateTime } from "../shared/format";
import { PRIORITY_LABEL, STATUS_LABEL } from "../shared/labels";
import type { MeetingDetail } from "../shared/types";

export function renderMeetingPdf(meeting: MeetingDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: meeting.title, Author: "Nexo" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#0f6b64").font("Times-Bold").fontSize(10).text("NEXO  ·  ATA DE REUNIÃO");
    doc.moveDown(0.45);
    doc.fillColor("#1d1915").font("Times-Bold").fontSize(22).text(meeting.title);
    doc.moveDown(0.25);
    doc.font("Times-Roman").fontSize(11).fillColor("#3f3832").text(formatDateTime(meeting.startsAt));
    doc.moveDown(0.35);
    doc.strokeColor("#e4d8c8").lineWidth(1).moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).stroke();
    doc.moveDown(0.7);

    section(doc, "Participantes", meeting.participants.join(", ") || "Não informados");
    section(doc, "Pauta", meeting.agenda.trim() || "Sem pauta.");
    section(doc, "Notas", meeting.notes.trim() || "Sem notas.");
    section(doc, "Decisões", meeting.decisions.length ? meeting.decisions.map((item, index) => `${index + 1}. ${item.content}`).join("\n") : "Nenhuma decisão registrada.");

    const actions = meeting.actionItems.length
      ? meeting.actionItems
          .map((item) => `• ${item.title} — ${item.assignee || "Sem responsável"} — ${formatDate(item.dueDate)} — ${PRIORITY_LABEL[item.priority]} — ${STATUS_LABEL[item.status]}`)
          .join("\n")
      : "Nenhum item de ação.";
    section(doc, "Itens de ação", actions);

    doc.moveDown(1);
    doc.font("Times-Italic").fontSize(9).fillColor("#6f665d").text("Gerado pelo Nexo.");
    doc.end();
  });
}

function section(doc: PDFKit.PDFDocument, title: string, body: string) {
  doc.moveDown(0.35);
  doc.font("Times-Bold").fontSize(13).fillColor("#0f6b64").text(title);
  doc.moveDown(0.2);
  doc.font("Times-Roman").fontSize(11).fillColor("#1d1915").text(body, { lineGap: 2 });
}
