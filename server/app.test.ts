import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "./app";
import { createDatabase } from "./db";

test("fluxo de tarefas, atas, vínculo e exportação", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexo-"));
  const db = createDatabase(path.join(dir, "test.sqlite"));
  const app = createApp(db, {
    now: () => new Date("2026-10-25T15:00:00.000Z"),
    timeZone: "America/Sao_Paulo",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function call(method: string, url: string, body?: unknown) {
    const response = await fetch(base + url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: response.status, data, text, headers: response.headers };
  }

  const health = await call("GET", "/api/health");
  assert.equal(health.status, 200);
  assert.equal((health.data as { today: string }).today, "2026-10-25");

  const extensions = await call("GET", "/api/extensions");
  assert.deepEqual(extensions.data, { summarizer: null, calendar: null });
  assert.equal((await call("GET", "/api/calendar/upcoming")).status, 501);

  const invalid = await call("POST", "/api/tasks", { title: "   " });
  assert.equal(invalid.status, 400);
  assert.match(JSON.stringify(invalid.data), /título/i);

  const badDate = await call("POST", "/api/tasks", { title: "Data ruim", dueDate: "2026-02-31" });
  assert.equal(badDate.status, 400);

  const late = await call("POST", "/api/tasks", {
    title: "Relatório mensal",
    description: "Fechar os números",
    priority: "high",
    dueDate: "2026-10-20",
    assignee: "Ana",
    tags: ["Casa", "casa", " pessoal "],
  });
  assert.equal(late.status, 201);
  const lateTask = late.data as { id: string; tags: string[]; overdue: boolean; meetingId: null };
  assert.equal(lateTask.overdue, true);
  assert.deepEqual(lateTask.tags, ["Casa", "pessoal"]);
  assert.equal(lateTask.meetingId, null);

  const todayTask = await call("POST", "/api/tasks", {
    title: "Ligar para o cliente",
    status: "in_progress",
    priority: "medium",
    dueDate: "2026-10-25",
    tags: ["trabalho"],
  });
  assert.equal((todayTask.data as { dueToday: boolean }).dueToday, true);

  await call("POST", "/api/tasks", { title: "Planejar novembro", priority: "low", dueDate: "2026-11-01" });
  await call("POST", "/api/tasks", { title: "Arquivar notas", status: "done", dueDate: "2026-10-01" });
  const loose = await call("POST", "/api/tasks", { title: "Ideia solta", priority: "low" });
  const looseId = (loose.data as { id: string }).id;

  const listed = await call("GET", "/api/tasks");
  const titles = (listed.data as { tasks: Array<{ title: string }> }).tasks.map((item) => item.title);
  assert.deepEqual(titles, ["Relatório mensal", "Ligar para o cliente", "Planejar novembro", "Ideia solta", "Arquivar notas"]);

  const overdue = await call("GET", "/api/tasks?due=atrasadas");
  assert.deepEqual((overdue.data as { tasks: Array<{ title: string }> }).tasks.map((item) => item.title), ["Relatório mensal"]);
  const dueToday = await call("GET", "/api/tasks?due=hoje&status=in_progress");
  assert.equal((dueToday.data as { tasks: unknown[] }).tasks.length, 1);
  const byTag = await call("GET", "/api/tasks?tag=CASA");
  assert.equal((byTag.data as { tasks: unknown[] }).tasks.length, 1);
  const byText = await call("GET", "/api/tasks?q=cliente");
  assert.equal((byText.data as { tasks: unknown[] }).tasks.length, 1);
  const week = await call("GET", "/api/tasks?due=semana");
  assert.deepEqual((week.data as { tasks: Array<{ title: string }> }).tasks.map((item) => item.title).sort(), ["Ligar para o cliente", "Planejar novembro"]);

  const renamed = await call("PATCH", `/api/tasks/${looseId}`, { title: "Ideia guardada", status: "done" });
  assert.equal(renamed.status, 200);
  assert.equal((renamed.data as { status: string }).status, "done");
  assert.equal((await call("DELETE", `/api/tasks/${looseId}`)).status, 204);
  assert.equal((await call("GET", `/api/tasks/${looseId}`)).status, 404);
  assert.equal((await call("DELETE", `/api/tasks/${looseId}`)).status, 404);

  const moved = await call("POST", "/api/tasks/reorder", {
    items: [{ id: lateTask.id, status: "in_progress", position: 3 }],
  });
  assert.equal(moved.status, 200);
  const movedTask = (moved.data as { tasks: Array<{ id: string; status: string; overdue: boolean }> }).tasks.find((item) => item.id === lateTask.id);
  assert.equal(movedTask?.status, "in_progress");
  assert.equal(movedTask?.overdue, true);

  const meeting = await call("POST", "/api/meetings", {
    title: "Reunião de planejamento",
    startsAt: "2026-10-25T14:30",
    participants: ["Ana Souza", "ana souza", "Bruno"],
    agenda: "Definir o cronograma do trimestre",
    notes: "A equipe alinhou as prioridades.",
    decisions: ["Manter o prazo de novembro"],
    actionItems: [
      { title: "Enviar a pauta", assignee: "Ana Souza", dueDate: "2026-10-28", priority: "high" },
      { title: "Reservar a sala", assignee: "Bruno", dueDate: null, priority: "low" },
    ],
  });
  assert.equal(meeting.status, 201);
  const created = meeting.data as {
    id: string;
    participants: string[];
    actionItems: Array<{ id: string; title: string; status: string; meetingId: string; meetingTitle: string }>;
  };
  assert.deepEqual(created.participants, ["Ana Souza", "Bruno"]);
  assert.equal(created.actionItems.length, 2);
  assert.equal(created.actionItems[0]?.status, "todo");
  assert.equal(created.actionItems[0]?.meetingTitle, "Reunião de planejamento");

  const linked = await call("GET", `/api/tasks/${created.actionItems[0]?.id}`);
  assert.equal((linked.data as { meetingId: string }).meetingId, created.id);

  await call("PATCH", `/api/tasks/${created.actionItems[0]?.id}`, { status: "done" });
  const refreshed = await call("GET", `/api/meetings/${created.id}`);
  const refreshedItems = (refreshed.data as { actionItems: Array<{ title: string; status: string }> }).actionItems;
  assert.equal(refreshedItems.find((item) => item.title === "Enviar a pauta")?.status, "done");

  const summary = await call("GET", "/api/meetings?q=reuniao&participant=ana&from=2026-10-25&to=2026-10-25");
  const summaries = (summary.data as { meetings: Array<{ title: string; openActionItems: number; totalActionItems: number }> }).meetings;
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.openActionItems, 1);
  assert.equal(summaries[0]?.totalActionItems, 2);
  assert.equal((await call("GET", "/api/meetings?q=cronograma")).status, 200);
  assert.equal((await call("GET", "/api/meetings?q=novembro")).data && ((await call("GET", "/api/meetings?q=novembro")).data as { meetings: unknown[] }).meetings.length, 1);
  assert.equal(((await call("GET", "/api/meetings?participant=carla")).data as { meetings: unknown[] }).meetings.length, 0);
  assert.equal(((await call("GET", "/api/meetings?from=2026-10-26")).data as { meetings: unknown[] }).meetings.length, 0);

  const updated = await call("PUT", `/api/meetings/${created.id}`, {
    title: "Reunião de planejamento",
    startsAt: "2026-10-25T14:30",
    participants: ["Ana Souza", "Bruno"],
    agenda: "Definir o cronograma do trimestre",
    notes: "Notas revistas.",
    decisions: ["Manter o prazo de novembro", "Publicar a ata"],
    actionItems: [
      { id: created.actionItems[0]?.id, title: "Enviar a pauta revisada", assignee: "Ana Souza", dueDate: "2026-10-28", priority: "high" },
      { title: "Confirmar presença", assignee: "Bruno", dueDate: "2026-10-26", priority: "medium" },
    ],
  });
  assert.equal(updated.status, 200);
  const updatedMeeting = updated.data as { decisions: unknown[]; actionItems: Array<{ title: string; status: string }> };
  assert.equal(updatedMeeting.decisions.length, 2);
  assert.equal(updatedMeeting.actionItems.find((item) => item.title === "Enviar a pauta revisada")?.status, "done");
  assert.equal(updatedMeeting.actionItems.some((item) => item.title === "Reservar a sala"), false);
  assert.equal((await call("GET", "/api/tasks?q=Reservar")).data && ((await call("GET", "/api/tasks?q=Reservar")).data as { tasks: unknown[] }).tasks.length, 0);

  const rejected = await call("PUT", `/api/meetings/${created.id}`, {
    title: "Reunião de planejamento",
    startsAt: "2026-10-25T14:30",
    actionItems: [{ id: "11111111-1111-4111-8111-111111111111", title: "Fantasma", assignee: "", dueDate: null, priority: "low" }],
  });
  assert.equal(rejected.status, 400);
  assert.equal(((await call("GET", `/api/meetings/${created.id}`)).data as { notes: string }).notes, "Notas revistas.");

  assert.equal((await call("POST", `/api/meetings/${created.id}/summary`)).status, 501);

  const markdown = await call("GET", `/api/meetings/${created.id}/export.md`);
  assert.equal(markdown.status, 200);
  assert.match(markdown.headers.get("content-type") ?? "", /text\/markdown/);
  assert.match(markdown.headers.get("content-disposition") ?? "", /ata-reuniao-de-planejamento\.md/);
  assert.match(markdown.text, /Reunião de planejamento/);
  assert.match(markdown.text, /Publicar a ata/);
  assert.match(markdown.text, /Enviar a pauta revisada/);
  assert.match(markdown.text, /Concluída/);

  const pdfResponse = await fetch(base + `/api/meetings/${created.id}/export.pdf`);
  const pdf = Buffer.from(await pdfResponse.arrayBuffer());
  assert.equal(pdfResponse.status, 200);
  assert.match(pdfResponse.headers.get("content-type") ?? "", /application\/pdf/);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 500);

  const keptId = updatedMeeting.actionItems[0] && created.actionItems[0]?.id;
  assert.equal((await call("DELETE", `/api/meetings/${created.id}`)).status, 204);
  assert.equal((await call("GET", `/api/meetings/${created.id}`)).status, 404);
  const unlinked = await call("GET", `/api/tasks/${keptId}`);
  assert.equal(unlinked.status, 200);
  assert.equal((unlinked.data as { meetingId: string | null }).meetingId, null);

  const board = await call("GET", "/api/dashboard");
  const dash = board.data as { counts: { todo: number; in_progress: number; done: number }; overdue: unknown[]; dueToday: unknown[] };
  assert.equal(dash.counts.todo + dash.counts.in_progress + dash.counts.done, (await call("GET", "/api/tasks")).data && ((await call("GET", "/api/tasks")).data as { tasks: unknown[] }).tasks.length);
  assert.ok(dash.overdue.length >= 1);
  assert.ok(dash.dueToday.length >= 1);
  assert.equal((await call("GET", "/api/does-not-exist")).status, 404);
});
