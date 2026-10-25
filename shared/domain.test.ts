import assert from "node:assert/strict";
import test from "node:test";
import { calendarDate } from "./dates";
import { filterTasks, sortTasksForList } from "./filterTasks";
import { actionSummary, formatDate, formatDateTime } from "./format";
import { moveTask } from "./moveTask";
import { fold, slugify } from "./text";
import type { Task } from "./types";

function task(partial: Partial<Task> & Pick<Task, "id" | "title" | "status">): Task {
  return {
    description: "",
    priority: "medium",
    dueDate: null,
    assignee: "",
    tags: [],
    meetingId: null,
    meetingTitle: null,
    position: 0,
    createdAt: "2026-10-25T12:00:00.000Z",
    updatedAt: "2026-10-25T12:00:00.000Z",
    overdue: false,
    dueToday: false,
    ...partial,
  };
}

test("data de hoje respeita o fuso de São Paulo", () => {
  assert.equal(calendarDate(new Date("2026-10-25T02:30:00Z"), "America/Sao_Paulo"), "2026-10-24");
  assert.equal(calendarDate(new Date("2026-10-25T15:00:00Z"), "America/Sao_Paulo"), "2026-10-25");
});

test("formatação e busca ignoram o fuso ao mostrar a data escolhida", () => {
  assert.equal(formatDate("2026-10-25"), "25/10/2026");
  assert.equal(formatDate(null), "Sem prazo");
  assert.equal(formatDateTime("2026-10-25T14:30"), "25/10/2026 às 14:30");
  assert.equal(fold("Reunião"), "reuniao");
  assert.equal(slugify("Reunião de planejamento"), "reuniao-de-planejamento");
  assert.equal(actionSummary(0, 0), "Nenhum item de ação");
  assert.equal(actionSummary(1, 2), "1 item em aberto");
});

test("filtros e ordenação da lista", () => {
  const today = "2026-10-25";
  const tasks = [
    task({ id: "done", title: "Arquivo", status: "done", dueDate: "2026-10-01", priority: "low" }),
    task({ id: "late", title: "Relatório", status: "todo", dueDate: "2026-10-20", overdue: true, priority: "high", tags: ["Casa"] }),
    task({ id: "none", title: "Ideia", status: "todo", priority: "low" }),
    task({ id: "today", title: "Ligar", status: "in_progress", dueDate: today, dueToday: true, tags: ["trabalho"] }),
    task({ id: "week", title: "Novembro", status: "todo", dueDate: "2026-11-01", priority: "low" }),
  ];
  assert.deepEqual(sortTasksForList(tasks).map((item) => item.id), ["late", "today", "week", "none", "done"]);
  assert.deepEqual(filterTasks(tasks, { due: "atrasadas" }, today).map((item) => item.id), ["late"]);
  assert.deepEqual(filterTasks(tasks, { due: "hoje" }, today).map((item) => item.id), ["today"]);
  assert.deepEqual(filterTasks(tasks, { due: "semana" }, today).map((item) => item.id), ["today", "week"]);
  assert.deepEqual(filterTasks(tasks, { due: "sem-prazo" }, today).map((item) => item.id), ["none"]);
  assert.deepEqual(filterTasks(tasks, { tag: "casa" }, today).map((item) => item.id), ["late"]);
  assert.deepEqual(filterTasks(tasks, { q: "ligar" }, today).map((item) => item.id), ["today"]);
  assert.equal(filterTasks(tasks, { status: "done" }, today).length, 1);
});

test("arrastar entre colunas e dentro da coluna", () => {
  const tasks = [
    task({ id: "a", title: "A", status: "todo", position: 0 }),
    task({ id: "b", title: "B", status: "todo", position: 1 }),
    task({ id: "c", title: "C", status: "in_progress", position: 0 }),
  ];
  const across = moveTask(tasks, "a", "c");
  assert.equal(across?.tasks.find((item) => item.id === "a")?.status, "in_progress");
  assert.equal(across?.tasks.find((item) => item.id === "a")?.position, 0);
  assert.equal(across?.tasks.find((item) => item.id === "c")?.position, 1);
  assert.ok(across?.changed.some((item) => item.id === "a" && item.status === "in_progress"));

  const inside = moveTask(tasks, "a", "b");
  assert.deepEqual(inside?.tasks.filter((item) => item.status === "todo").sort((x, y) => x.position - y.position).map((item) => item.id), ["b", "a"]);

  const appended = moveTask(tasks, "c", "column:done");
  assert.equal(appended?.tasks.find((item) => item.id === "c")?.status, "done");
  assert.equal(appended?.tasks.find((item) => item.id === "c")?.position, 0);
  assert.equal(moveTask(tasks, "a", "missing"), null);
});
