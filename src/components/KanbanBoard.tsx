import { useState } from "react";
import { Link } from "react-router-dom";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDate } from "../../shared/format";
import { PRIORITY_LABEL, STATUS_LABEL } from "../../shared/labels";
import { moveTask } from "../../shared/moveTask";
import { STATUSES, type ReorderItem, type Status, type Task } from "../../shared/types";

export function KanbanBoard({
  visible,
  allTasks,
  onOpen,
  onMove,
}: {
  visible: Task[];
  allTasks: Task[];
  onOpen: (task: Task) => void;
  onMove: (tasks: Task[], changed: ReorderItem[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const active = allTasks.find((task) => task.id === activeId) ?? null;

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over) return;
    const result = moveTask(allTasks, String(event.active.id), String(event.over.id));
    if (!result || result.changed.length === 0) return;
    onMove(result.tasks, result.changed);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="kanban">
        {STATUSES.map((status) => (
          <Column key={status} status={status} tasks={visible.filter((task) => task.status === status).sort((a, b) => a.position - b.position)} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay>{active ? <CardPreview task={active} /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks, onOpen }: { status: Status; tasks: Task[]; onOpen: (task: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });
  return (
    <section className={`kanban-col ${isOver ? "is-over" : ""}`}>
      <header>
        <h2>{STATUS_LABEL[status]}</h2>
        <span>{tasks.length}</span>
      </header>
      <div ref={setNodeRef} className="kanban-list">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} onOpen={onOpen} />
          ))}
        </SortableContext>
        {tasks.length === 0 && <p className="empty-inline">Solte uma tarefa aqui.</p>}
      </div>
    </section>
  );
}

function SortableCard({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`task-card ${isDragging ? "is-dragging" : ""} ${task.overdue ? "is-overdue" : ""} ${task.dueToday ? "is-today" : ""}`}
      data-priority={task.priority}
    >
      <div className="card-top">
        <button type="button" className="drag-handle" aria-label={`Arrastar ${task.title}`} ref={setActivatorNodeRef} {...attributes} {...listeners}>
          ⠿
        </button>
        <button type="button" className="card-title" onClick={() => onOpen(task)}>
          {task.title}
        </button>
      </div>
      <CardBody task={task} />
    </article>
  );
}

function CardPreview({ task }: { task: Task }) {
  return (
    <article className="task-card overlay" data-priority={task.priority}>
      <strong>{task.title}</strong>
      <CardBody task={task} />
    </article>
  );
}

function CardBody({ task }: { task: Task }) {
  return (
    <div className="card-body">
      <div className="flags">
        {task.overdue && <span className="flag overdue">Atrasada</span>}
        {task.dueToday && <span className="flag today">Hoje</span>}
        <span className={`priority ${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
      </div>
      <p className="meta-line">
        <span>{formatDate(task.dueDate)}</span>
        <span>{task.assignee || "Sem responsável"}</span>
      </p>
      {task.tags.length > 0 && (
        <div className="tag-row">
          {task.tags.map((tag) => (
            <span key={tag} className="chip quiet">
              {tag}
            </span>
          ))}
        </div>
      )}
      {task.meetingId && (
        <Link to={`/reunioes/${task.meetingId}`} className="origin-link" onClick={(event) => event.stopPropagation()}>
          Ata: {task.meetingTitle}
        </Link>
      )}
    </div>
  );
}
