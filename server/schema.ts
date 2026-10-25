import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Priority, Status } from "../shared/types";

export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  startsAt: text("starts_at").notNull(),
  participants: text("participants").notNull(),
  agenda: text("agenda").notNull(),
  notes: text("notes").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id").notNull(),
  content: text("content").notNull(),
  position: integer("position").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").$type<Status>().notNull(),
  priority: text("priority").$type<Priority>().notNull(),
  dueDate: text("due_date"),
  assignee: text("assignee").notNull(),
  tags: text("tags").notNull(),
  meetingId: text("meeting_id"),
  meetingPosition: integer("meeting_position"),
  position: integer("position").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
