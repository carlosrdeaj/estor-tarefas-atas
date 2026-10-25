import { asc, eq, inArray, sql } from "drizzle-orm";
import { filterTasks, sortTasksForList } from "../shared/filterTasks";
import { includesFold, normalizeList, parseStringArray, previewText } from "../shared/text";
import type { MeetingDetail, MeetingInput, MeetingSummary, Status, Task, TaskFilter, TaskInput } from "../shared/types";
import type { AppDatabase } from "./db";
import { HttpError } from "./http";
import { decisions, meetings, tasks } from "./schema";

export type Ctx = {
  db: AppDatabase;
  today: () => string;
  nowIso: () => string;
};

type TaskRow = typeof tasks.$inferSelect;

function mapTask(row: TaskRow, meetingTitle: string | null, today: string): Task {
  const open = row.status !== "done";
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    assignee: row.assignee,
    tags: parseStringArray(row.tags),
    meetingId: row.meetingId,
    meetingTitle,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    overdue: Boolean(open && row.dueDate && row.dueDate < today),
    dueToday: Boolean(open && row.dueDate && row.dueDate === today),
  };
}

function meetingTitles(ctx: Ctx, ids: Array<string | null>): Map<string, string> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const rows = ctx.db.orm.select({ id: meetings.id, title: meetings.title }).from(meetings).where(inArray(meetings.id, unique)).all();
  return new Map(rows.map((row) => [row.id, row.title]));
}

export function listAllTasks(ctx: Ctx): Task[] {
  const rows = ctx.db.orm.select().from(tasks).all();
  const titles = meetingTitles(ctx, rows.map((row) => row.meetingId));
  const today = ctx.today();
  return rows.map((row) => mapTask(row, row.meetingId ? titles.get(row.meetingId) ?? null : null, today));
}

export function listTasks(ctx: Ctx, filter: TaskFilter) {
  const all = listAllTasks(ctx);
  const tags = [...new Set(all.flatMap((task) => task.tags))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    today: ctx.today(),
    tags,
    tasks: sortTasksForList(filterTasks(all, filter, ctx.today())),
  };
}

export function getTask(ctx: Ctx, id: string): Task | null {
  return listAllTasks(ctx).find((task) => task.id === id) ?? null;
}

function nextPosition(ctx: Ctx, status: Status): number {
  const row = ctx.db.orm
    .select({ maxPos: sql<number>`coalesce(max(${tasks.position}), -1)` })
    .from(tasks)
    .where(eq(tasks.status, status))
    .get();
  return Number(row?.maxPos ?? -1) + 1;
}

export function createTask(ctx: Ctx, input: TaskInput): Task {
  const now = ctx.nowIso();
  const id = crypto.randomUUID();
  ctx.db.orm
    .insert(tasks)
    .values({
      id,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate,
      assignee: input.assignee,
      tags: JSON.stringify(normalizeList(input.tags, 12, 40)),
      meetingId: null,
      meetingPosition: null,
      position: nextPosition(ctx, input.status),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getTask(ctx, id)!;
}

export function updateTask(ctx: Ctx, id: string, input: Partial<TaskInput>): Task {
  const current = ctx.db.orm.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!current) throw new HttpError(404, "Tarefa não encontrada.");
  const changes: Partial<typeof tasks.$inferInsert> = { updatedAt: ctx.nowIso() };
  if (input.title !== undefined) changes.title = input.title;
  if (input.description !== undefined) changes.description = input.description;
  if (input.priority !== undefined) changes.priority = input.priority;
  if (input.dueDate !== undefined) changes.dueDate = input.dueDate;
  if (input.assignee !== undefined) changes.assignee = input.assignee;
  if (input.tags !== undefined) changes.tags = JSON.stringify(normalizeList(input.tags, 12, 40));
  if (input.status !== undefined) {
    changes.status = input.status;
    if (input.status !== current.status) changes.position = nextPosition(ctx, input.status);
  }
  ctx.db.orm.update(tasks).set(changes).where(eq(tasks.id, id)).run();
  return getTask(ctx, id)!;
}

export function deleteTask(ctx: Ctx, id: string) {
  const current = ctx.db.orm.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id)).get();
  if (!current) throw new HttpError(404, "Tarefa não encontrada.");
  ctx.db.orm.delete(tasks).where(eq(tasks.id, id)).run();
}

export function reorderTasks(ctx: Ctx, items: Array<{ id: string; status: Status; position: number }>) {
  const now = ctx.nowIso();
  ctx.db.orm.transaction((tx) => {
    for (const item of items) {
      const current = tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, item.id)).get();
      if (!current) throw new HttpError(404, "Tarefa não encontrada.");
      tx.update(tasks).set({ status: item.status, position: item.position, updatedAt: now }).where(eq(tasks.id, item.id)).run();
    }
  });
}

function actionSummaryRows(taskRows: TaskRow[]) {
  return {
    total: taskRows.length,
    open: taskRows.filter((task) => task.status !== "done").length,
  };
}

export function listMeetings(ctx: Ctx, query: { q?: string; participant?: string; from?: string; to?: string }): MeetingSummary[] {
  let rows = ctx.db.orm.select().from(meetings).orderBy(asc(meetings.startsAt)).all();
  if (query.from) rows = rows.filter((row) => row.startsAt >= query.from!);
  if (query.to) rows = rows.filter((row) => row.startsAt <= `${query.to}T23:59`);
  rows.reverse();
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const decisionRows = ctx.db.orm.select().from(decisions).where(inArray(decisions.meetingId, ids)).all();
  const taskRows = ctx.db.orm.select().from(tasks).where(inArray(tasks.meetingId, ids)).all();
  const queryText = query.q?.trim() ?? "";
  const participant = query.participant?.trim() ?? "";
  const summaries: MeetingSummary[] = [];

  for (const row of rows) {
    const participants = parseStringArray(row.participants);
    const relatedDecisions = decisionRows.filter((item) => item.meetingId === row.id);
    const relatedTasks = taskRows.filter((item) => item.meetingId === row.id);
    if (participant && !participants.some((name) => includesFold(name, participant))) continue;
    if (queryText) {
      const blob = [row.title, row.agenda, row.notes, ...participants, ...relatedDecisions.map((item) => item.content), ...relatedTasks.map((item) => `${item.title} ${item.assignee}`)].join("\n");
      if (!includesFold(blob, queryText)) continue;
    }
    const counts = actionSummaryRows(relatedTasks);
    summaries.push({
      id: row.id,
      title: row.title,
      startsAt: row.startsAt,
      participants,
      agendaPreview: previewText(row.agenda),
      openActionItems: counts.open,
      totalActionItems: counts.total,
      updatedAt: row.updatedAt,
    });
  }
  return summaries;
}

export function getMeeting(ctx: Ctx, id: string): MeetingDetail | null {
  const row = ctx.db.orm.select().from(meetings).where(eq(meetings.id, id)).get();
  if (!row) return null;
  const decisionRows = ctx.db.orm.select().from(decisions).where(eq(decisions.meetingId, id)).orderBy(asc(decisions.position)).all();
  const taskRows = ctx.db.orm.select().from(tasks).where(eq(tasks.meetingId, id)).orderBy(asc(tasks.meetingPosition), asc(tasks.position)).all();
  const today = ctx.today();
  return {
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    participants: parseStringArray(row.participants),
    agenda: row.agenda,
    notes: row.notes,
    decisions: decisionRows.map((item) => ({ id: item.id, content: item.content })),
    actionItems: taskRows.map((item) => mapTask(item, row.title, today)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function insertActionItem(
  tx: Ctx["db"]["orm"],
  meetingId: string,
  item: MeetingInput["actionItems"][number],
  index: number,
  position: number,
  now: string,
) {
  tx.insert(tasks)
    .values({
      id: crypto.randomUUID(),
      title: item.title,
      description: "",
      status: "todo",
      priority: item.priority,
      dueDate: item.dueDate,
      assignee: item.assignee,
      tags: "[]",
      meetingId,
      meetingPosition: index,
      position,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

export function createMeeting(ctx: Ctx, input: MeetingInput): MeetingDetail {
  const id = crypto.randomUUID();
  const now = ctx.nowIso();
  const participants = normalizeList(input.participants, 30);
  let position = nextPosition(ctx, "todo");
  ctx.db.orm.transaction((tx) => {
    tx.insert(meetings)
      .values({
        id,
        title: input.title,
        startsAt: input.startsAt,
        participants: JSON.stringify(participants),
        agenda: input.agenda,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    input.decisions.forEach((content, position) => {
      tx.insert(decisions).values({ id: crypto.randomUUID(), meetingId: id, content, position }).run();
    });
    input.actionItems.forEach((item, index) => {
      insertActionItem(tx as unknown as Ctx["db"]["orm"], id, item, index, position, now);
      position += 1;
    });
  });
  return getMeeting(ctx, id)!;
}

export function updateMeeting(ctx: Ctx, id: string, input: MeetingInput): MeetingDetail {
  const existing = ctx.db.orm.select().from(meetings).where(eq(meetings.id, id)).get();
  if (!existing) throw new HttpError(404, "Ata não encontrada.");
  const now = ctx.nowIso();
  let position = nextPosition(ctx, "todo");
  ctx.db.orm.transaction((tx) => {
    tx.update(meetings)
      .set({
        title: input.title,
        startsAt: input.startsAt,
        participants: JSON.stringify(normalizeList(input.participants, 30)),
        agenda: input.agenda,
        notes: input.notes,
        updatedAt: now,
      })
      .where(eq(meetings.id, id))
      .run();
    tx.delete(decisions).where(eq(decisions.meetingId, id)).run();
    input.decisions.forEach((content, position) => {
      tx.insert(decisions).values({ id: crypto.randomUUID(), meetingId: id, content, position }).run();
    });

    const current = tx.select().from(tasks).where(eq(tasks.meetingId, id)).all();
    const known = new Set(current.map((task) => task.id));
    const keep = new Set<string>();
    input.actionItems.forEach((item, index) => {
      if (!item.id) {
        insertActionItem(tx as unknown as Ctx["db"]["orm"], id, item, index, position, now);
        position += 1;
        return;
      }
      if (!known.has(item.id)) throw new HttpError(400, "Item de ação não pertence a esta ata.");
      keep.add(item.id);
      tx.update(tasks)
        .set({
          title: item.title,
          assignee: item.assignee,
          dueDate: item.dueDate,
          priority: item.priority,
          meetingPosition: index,
          updatedAt: now,
        })
        .where(eq(tasks.id, item.id))
        .run();
    });
    for (const task of current) {
      if (!keep.has(task.id)) tx.delete(tasks).where(eq(tasks.id, task.id)).run();
    }
  });
  return getMeeting(ctx, id)!;
}

export function deleteMeeting(ctx: Ctx, id: string) {
  const existing = ctx.db.orm.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, id)).get();
  if (!existing) throw new HttpError(404, "Ata não encontrada.");
  ctx.db.orm.delete(meetings).where(eq(meetings.id, id)).run();
}

export function dashboard(ctx: Ctx) {
  const all = listAllTasks(ctx);
  const counts: Record<Status, number> = { todo: 0, in_progress: 0, done: 0 };
  for (const task of all) counts[task.status] += 1;
  return {
    today: ctx.today(),
    counts,
    dueToday: sortTasksForList(all.filter((task) => task.dueToday)),
    overdue: sortTasksForList(all.filter((task) => task.overdue)),
    recentMeetings: listMeetings(ctx, {}).slice(0, 5),
  };
}

export function taskFiltersFromQuery(query: Record<string, unknown>): TaskFilter {
  const status = typeof query.status === "string" ? query.status : "";
  const priority = typeof query.priority === "string" ? query.priority : "";
  const due = typeof query.due === "string" ? query.due : "";
  return {
    q: typeof query.q === "string" ? query.q : "",
    status: status === "todo" || status === "in_progress" || status === "done" ? status : "",
    priority: priority === "low" || priority === "medium" || priority === "high" ? priority : "",
    due: due === "atrasadas" || due === "hoje" || due === "semana" || due === "sem-prazo" ? due : "",
    tag: typeof query.tag === "string" ? query.tag : "",
  };
}
