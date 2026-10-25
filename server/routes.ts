import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { slugify } from "../shared/text";
import { getCalendarConnector } from "./extensions/calendar";
import { getSummarizer } from "./extensions/summarizer";
import { asyncHandler, readBody } from "./http";
import { renderMeetingMarkdown } from "./markdown";
import { renderMeetingPdf } from "./pdf";
import {
  createMeeting,
  createTask,
  dashboard,
  deleteMeeting,
  deleteTask,
  getMeeting,
  getTask,
  listMeetings,
  listTasks,
  reorderTasks,
  taskFiltersFromQuery,
  updateMeeting,
  updateTask,
  type Ctx,
} from "./repository";
import { meetingSchema, reorderSchema, taskCreateSchema, taskPatchSchema } from "./schemas";

function paramId(value: Request["params"][string] | undefined): string | null {
  const id = Array.isArray(value) ? value[0] : value;
  return id && z.string().uuid().safeParse(id).success ? id : null;
}

export function apiRouter(ctx: Ctx) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, today: ctx.today() });
  });

  router.get("/extensions", (_req, res) => {
    res.json({
      summarizer: getSummarizer()?.name ?? null,
      calendar: getCalendarConnector()?.name ?? null,
    });
  });

  router.get("/calendar/upcoming", asyncHandler(async (_req, res) => {
    const connector = getCalendarConnector();
    if (!connector) {
      res.status(501).json({ error: "Integração de calendário ainda não está configurada." });
      return;
    }
    res.json({ events: await connector.listUpcoming() });
  }));

  router.get("/dashboard", (_req, res) => {
    res.json(dashboard(ctx));
  });

  router.get("/tasks", (req, res) => {
    res.json(listTasks(ctx, taskFiltersFromQuery(req.query as Record<string, unknown>)));
  });

  router.post("/tasks/reorder", (req, res) => {
    const body = readBody(reorderSchema, req.body, res);
    if (!body) return;
    reorderTasks(ctx, body.items);
    res.json(listTasks(ctx, {}));
  });

  router.post("/tasks", (req, res) => {
    const body = readBody(taskCreateSchema, req.body, res);
    if (!body) return;
    res.status(201).json(createTask(ctx, body));
  });

  router.get("/tasks/:id", (req, res) => {
    const id = paramId(req.params.id);
    const task = id ? getTask(ctx, id) : null;
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada." });
      return;
    }
    res.json(task);
  });

  router.patch("/tasks/:id", (req, res) => {
    const id = paramId(req.params.id);
    if (!id) {
      res.status(404).json({ error: "Tarefa não encontrada." });
      return;
    }
    const body = readBody(taskPatchSchema, req.body, res);
    if (!body) return;
    res.json(updateTask(ctx, id, body));
  });

  router.delete("/tasks/:id", (req, res) => {
    const id = paramId(req.params.id);
    if (!id) {
      res.status(404).json({ error: "Tarefa não encontrada." });
      return;
    }
    deleteTask(ctx, id);
    res.status(204).end();
  });

  router.get("/meetings", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const participant = typeof req.query.participant === "string" ? req.query.participant : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    res.json({ meetings: listMeetings(ctx, { q, participant, from, to }) });
  });

  router.post("/meetings", (req, res) => {
    const body = readBody(meetingSchema, req.body, res);
    if (!body) return;
    res.status(201).json(createMeeting(ctx, body));
  });

  router.get("/meetings/:id/export.md", (req, res) => {
    const meeting = meetingOr404(ctx, req, res);
    if (!meeting) return;
    const filename = `ata-${slugify(meeting.title)}.md`;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(renderMeetingMarkdown(meeting));
  });

  router.get("/meetings/:id/export.pdf", asyncHandler(async (req, res) => {
    const meeting = meetingOr404(ctx, req, res);
    if (!meeting) return;
    const filename = `ata-${slugify(meeting.title)}.pdf`;
    const pdf = await renderMeetingPdf(meeting);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdf);
  }));

  router.post("/meetings/:id/summary", asyncHandler(async (req, res) => {
    const summarizer = getSummarizer();
    if (!summarizer) {
      res.status(501).json({ error: "Resumo por IA ainda não está configurado." });
      return;
    }
    const meeting = meetingOr404(ctx, req, res);
    if (!meeting) return;
    const summary = await summarizer.summarize({
      title: meeting.title,
      startsAt: meeting.startsAt,
      participants: meeting.participants,
      agenda: meeting.agenda,
      notes: meeting.notes,
      decisions: meeting.decisions.map((decision) => decision.content),
    });
    res.json({ summary });
  }));

  router.get("/meetings/:id", (req, res) => {
    const meeting = meetingOr404(ctx, req, res);
    if (!meeting) return;
    res.json(meeting);
  });

  router.put("/meetings/:id", (req, res) => {
    const id = paramId(req.params.id);
    if (!id) {
      res.status(404).json({ error: "Ata não encontrada." });
      return;
    }
    const body = readBody(meetingSchema, req.body, res);
    if (!body) return;
    res.json(updateMeeting(ctx, id, body));
  });

  router.delete("/meetings/:id", (req, res) => {
    const id = paramId(req.params.id);
    if (!id) {
      res.status(404).json({ error: "Ata não encontrada." });
      return;
    }
    deleteMeeting(ctx, id);
    res.status(204).end();
  });

  return router;
}

function meetingOr404(ctx: Ctx, req: Request, res: import("express").Response) {
  const id = paramId(req.params.id);
  const meeting = id ? getMeeting(ctx, id) : null;
  if (!meeting) {
    res.status(404).json({ error: "Ata não encontrada." });
    return null;
  }
  return meeting;
}
