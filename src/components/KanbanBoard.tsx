import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState } from 'react'
import { STATUS_LABEL, STATUSES, isStatus, type Status, type Task } from '../../shared/types'
import { cx } from '../format'
import { TaskCard } from './TaskCard'

type KanbanBoardProps = {
  tasks: Task[]
  today: string
  hrefFor: (task: Task) => string
  onMove: (task: Task, status: Status) => void
}

function Grip() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="5" cy="3.5" r="1.2" />
      <circle cx="11" cy="3.5" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="12.5" r="1.2" />
      <circle cx="11" cy="12.5" r="1.2" />
    </svg>
  )
}

function DraggableCard({ task, today, href }: { task: Task; today: string; href: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <TaskCard
      task={task}
      today={today}
      href={href}
      dragging={isDragging}
      setNodeRef={setNodeRef}
      dragProps={{
        ...listeners,
        'aria-roledescription': attributes['aria-roledescription'],
        'aria-describedby': attributes['aria-describedby'],
      }}
      handle={
        <div className="drag-handle" aria-hidden="true">
          <Grip />
        </div>
      }
    />
  )
}

function Column({ status, tasks, today, hrefFor }: { status: Status; tasks: Task[]; today: string; hrefFor: (task: Task) => string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section ref={setNodeRef} className={cx('column', `column-${status}`, isOver && 'is-over')} aria-label={STATUS_LABEL[status]}>
      <header>
        <h2>{STATUS_LABEL[status]}</h2>
        <span>{tasks.length}</span>
      </header>
      <div className="column-body">
        {tasks.length === 0 && <p className="drop-hint">Solte uma tarefa aqui</p>}
        {tasks.map((task) => (
          <DraggableCard key={task.id} task={task} today={today} href={hrefFor(task)} />
        ))}
      </div>
    </section>
  )
}

export function KanbanBoard({ tasks, today, hrefFor, onMove }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const grouped: Record<Status, Task[]> = { todo: [], in_progress: [], done: [] }
  for (const task of tasks) grouped[task.status].push(task)
  for (const status of STATUSES) grouped[status].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const active = tasks.find((task) => task.id === activeId) ?? null

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const task = tasks.find((item) => item.id === String(event.active.id))
    const overId = event.over ? String(event.over.id) : ''
    if (!task || !isStatus(overId) || task.status === overId) return
    onMove(task, overId)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Para pegar uma tarefa, pressione espaço ou enter. Use as setas para mudar de coluna. Solte com espaço ou enter. Cancele com escape.',
        },
        announcements: {
          onDragStart({ active: dragged }) {
            const task = tasks.find((item) => item.id === String(dragged.id))
            return `Arrastando ${task?.title ?? 'tarefa'}.`
          },
          onDragOver({ over }) {
            const overId = over ? String(over.id) : ''
            return isStatus(overId) ? `Sobre a coluna ${STATUS_LABEL[overId]}.` : 'Fora de uma coluna.'
          },
          onDragEnd({ over }) {
            const overId = over ? String(over.id) : ''
            return isStatus(overId) ? `Tarefa solta em ${STATUS_LABEL[overId]}.` : 'Arraste cancelado.'
          },
          onDragCancel() {
            return 'Arraste cancelado.'
          },
        },
      }}
    >
      <p className="board-help">Arraste um card para outra coluna para mudar o status. O destaque mostra atrasadas e tarefas do dia.</p>
      <div className="board">
        {STATUSES.map((status) => (
          <Column key={status} status={status} tasks={grouped[status]} today={today} hrefFor={hrefFor} />
        ))}
      </div>
      <DragOverlay>
        {active ? <TaskCard task={active} today={today} href={hrefFor(active)} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
