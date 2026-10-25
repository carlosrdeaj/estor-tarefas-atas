import type { Task } from '../shared/types'
import { addDays, daysBetween, formatDatePt, formatDateTimePt } from '../shared/text'

export function dueHint(dueDate: string | null, today: string): string | null {
  if (!dueDate) return null
  if (dueDate === today) return 'Hoje'
  if (dueDate === addDays(today, 1)) return 'Amanhã'
  if (dueDate === addDays(today, -1)) return 'Ontem'
  if (dueDate < today) {
    const days = daysBetween(dueDate, today)
    return days === 1 ? '1 dia atrás' : `${days} dias atrás`
  }
  return formatDatePt(dueDate)
}

export function taskFlags(task: Pick<Task, 'dueDate' | 'status'>, today: string) {
  const open = task.status !== 'done'
  return {
    overdue: Boolean(open && task.dueDate && task.dueDate < today),
    dueToday: Boolean(open && task.dueDate === today),
  }
}

export function actionSummary(total: number, done: number): string {
  if (total === 0) return 'Sem itens de ação'
  if (done === total) return total === 1 ? '1 item concluído' : `${total} itens concluídos`
  return `${done} de ${total} concluídos`
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export { formatDatePt, formatDateTimePt }
