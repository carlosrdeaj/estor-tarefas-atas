import { STATUSES, type ReorderItem, type Status, type Task } from "./types";

function byPosition(a: Task, b: Task): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}

export function moveTask(
  tasks: Task[],
  activeId: string,
  overId: string,
): { tasks: Task[]; changed: ReorderItem[] } | null {
  const active = tasks.find((task) => task.id === activeId);
  if (!active || activeId === overId) return active ? { tasks, changed: [] } : null;

  const columnName = overId.startsWith("column:") ? overId.slice("column:".length) : null;
  const overTask = columnName ? undefined : tasks.find((task) => task.id === overId);
  if (columnName && !isStatus(columnName)) return null;
  if (!columnName && !overTask) return null;
  const toStatus: Status = columnName && isStatus(columnName) ? columnName : overTask!.status;
  const columnStatus = Boolean(columnName);

  const source = tasks.filter((task) => task.status === active.status).sort(byPosition);
  if (toStatus === active.status && columnStatus) return { tasks, changed: [] };

  if (toStatus === active.status) {
    const oldIndex = source.findIndex((task) => task.id === activeId);
    const newIndex = source.findIndex((task) => task.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return { tasks, changed: [] };
    const next = source.slice();
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    return apply(tasks, next.map((task, position) => ({ ...task, position })));
  }

  const destination = tasks.filter((task) => task.status === toStatus).sort(byPosition);
  const remainingSource = source.filter((task) => task.id !== activeId);
  const overIndex = overTask ? destination.findIndex((task) => task.id === overTask.id) : destination.length;
  const nextDestination = destination.slice();
  nextDestination.splice(Math.max(overIndex, 0), 0, { ...active, status: toStatus });
  return apply(tasks, [
    ...remainingSource.map((task, position) => ({ ...task, position })),
    ...nextDestination.map((task, position) => ({ ...task, status: toStatus, position })),
  ]);
}

function apply(tasks: Task[], updates: Task[]) {
  const map = new Map(updates.map((task) => [task.id, task]));
  const next = tasks.map((task) => map.get(task.id) ?? task);
  const changed = next
    .filter((task) => {
      const previous = tasks.find((item) => item.id === task.id);
      return previous && (previous.status !== task.status || previous.position !== task.position);
    })
    .map((task) => ({ id: task.id, status: task.status, position: task.position }));
  return { tasks: next, changed };
}
