import { addDays } from "./dates";
import { PRIORITY_LABEL } from "./labels";
import type { Priority, Task, TaskFilter } from "./types";
import { fold, includesFold } from "./text";

const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function group(task: Task): number {
  if (task.status === "done") return 4;
  if (task.overdue) return 0;
  if (task.dueToday) return 1;
  if (task.dueDate) return 2;
  return 3;
}

export function sortTasksForList(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const groupDiff = group(a) - group(b);
    if (groupDiff !== 0) return groupDiff;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.title.localeCompare(b.title, "pt-BR");
  });
}

export function filterTasks(tasks: Task[], filter: TaskFilter, today: string): Task[] {
  const query = filter.q?.trim() ?? "";
  const weekEnd = addDays(today, 7);
  return tasks.filter((task) => {
    if (filter.status && task.status !== filter.status) return false;
    if (filter.priority && task.priority !== filter.priority) return false;
    if (filter.tag && !task.tags.some((tag) => fold(tag) === fold(filter.tag ?? ""))) return false;
    if (filter.due === "atrasadas" && !task.overdue) return false;
    if (filter.due === "hoje" && task.dueDate !== today) return false;
    if (filter.due === "sem-prazo" && task.dueDate) return false;
    if (filter.due === "semana" && (!task.dueDate || task.dueDate < today || task.dueDate > weekEnd)) return false;
    if (!query) return true;
    const blob = [task.title, task.description, task.assignee, task.meetingTitle ?? "", ...task.tags, PRIORITY_LABEL[task.priority]].join("\n");
    return includesFold(blob, query);
  });
}
