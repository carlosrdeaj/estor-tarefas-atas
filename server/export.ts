import PDFDocument from 'pdfkit'
import { STATUS_LABEL, type Meeting } from '../shared/types'
import { formatDatePt, formatDateTimePt, slugify } from '../shared/text'

export function downloadName(title: string, extension: 'md' | 'pdf'): string {
  return `${slugify(title)}.${extension}`
}

export function meetingToMarkdown(meeting: Meeting): string {
  const lines = [
    `# ${meeting.title}`,
    '',
    `**Data:** ${formatDateTimePt(meeting.startsAt)}`,
    `**Participantes:** ${meeting.participants.length > 0 ? meeting.participants.join(', ') : 'Não informados'}`,
    '',
    '## Pauta',
    '',
    meeting.agenda.trim() || '_Nada registrado._',
    '',
    '## Notas',
    '',
    meeting.notes.trim() || '_Nada registrado._',
    '',
    '## Decisões',
    '',
  ]
  if (meeting.decisions.length === 0) lines.push('_Nenhuma decisão registrada._')
  else meeting.decisions.forEach((decision) => lines.push(`- ${decision.content}`))
  lines.push('', '## Itens de ação', '')
  if (meeting.actionItems.length === 0) {
    lines.push('_Nenhum item de ação._')
  } else {
    for (const item of meeting.actionItems) {
      const status = item.task ? STATUS_LABEL[item.task.status] : 'Sem tarefa'
      const mark = item.task?.status === 'done' ? 'x' : ' '
      const who = item.assignee || 'Sem responsável'
      const due = item.dueDate ? formatDatePt(item.dueDate) : 'sem prazo'
      lines.push(`- [${mark}] ${item.content} — ${who} — ${due} — ${status}`)
    }
  }
  lines.push('', '_Gerado por Pauta._', '')
  return lines.join('\n')
}

function toPdfText(value: string): string {
  return value
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/[^\n\r\t\u0020-\u00ff]/g, '')
}

export function meetingToPdf(meeting: Meeting): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 56,
      info: {
        Title: toPdfText(meeting.title),
        Author: 'Pauta',
      },
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const width = doc.page.width - 112
    doc.save()
    doc.rect(0, 0, doc.page.width, 68).fill('#1f6a4e')
    doc.restore()
    doc.fillColor('#f4fbf7').font('Helvetica-Bold').fontSize(13)
    doc.text('PAUTA', 56, 28, { width, lineBreak: false })
    doc.font('Helvetica').fontSize(10).text('Ata de reunião', 120, 30, { lineBreak: false })

    doc.fillColor('#1c1916').font('Helvetica-Bold').fontSize(20)
    doc.text(toPdfText(meeting.title), 56, 92, { width })
    doc.moveDown(0.4)
    doc.font('Helvetica').fontSize(11).fillColor('#4e463f')
    doc.text(toPdfText(`Data: ${formatDateTimePt(meeting.startsAt)}`), { width })
    const people = meeting.participants.length > 0 ? meeting.participants.join(', ') : 'Não informados'
    doc.text(toPdfText(`Participantes: ${people}`), { width })

    const section = (title: string, body: string) => {
      doc.moveDown(0.9)
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#1f6a4e').text(toPdfText(title), { width })
      doc.moveDown(0.25)
      doc.font('Helvetica').fontSize(11).fillColor('#1c1916').text(toPdfText(body.trim() || 'Nada registrado.'), { width })
    }

    section('Pauta', meeting.agenda)
    section('Notas', meeting.notes)

    doc.moveDown(0.9)
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1f6a4e').text('Decisões', { width })
    doc.moveDown(0.25)
    doc.font('Helvetica').fontSize(11).fillColor('#1c1916')
    if (meeting.decisions.length === 0) doc.text('Nenhuma decisão registrada.', { width })
    else meeting.decisions.forEach((decision, index) => doc.text(toPdfText(`${index + 1}. ${decision.content}`), { width }))

    doc.moveDown(0.9)
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1f6a4e').text('Itens de ação', { width })
    doc.moveDown(0.25)
    doc.font('Helvetica').fontSize(11).fillColor('#1c1916')
    if (meeting.actionItems.length === 0) {
      doc.text('Nenhum item de ação.', { width })
    } else {
      for (const item of meeting.actionItems) {
        const mark = item.task?.status === 'done' ? '[x]' : '[ ]'
        const status = item.task ? STATUS_LABEL[item.task.status] : 'Sem tarefa'
        const who = item.assignee || 'Sem responsável'
        const due = item.dueDate ? formatDatePt(item.dueDate) : 'sem prazo'
        doc.text(toPdfText(`${mark} ${item.content} - ${who} - ${due} - ${status}`), { width })
      }
    }

    doc.moveDown(1.4)
    doc.fontSize(9).fillColor('#6e655c').text('Gerado por Pauta.', { width })
    doc.end()
  })
}
