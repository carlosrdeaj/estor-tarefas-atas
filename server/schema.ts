import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const meetings = sqliteTable('meetings', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  startsAt: text('starts_at').notNull(),
  participants: text('participants').notNull(),
  participantsSearch: text('participants_search').notNull(),
  agenda: text('agenda').notNull(),
  notes: text('notes').notNull(),
  searchText: text('search_text').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  dueDate: text('due_date'),
  assignee: text('assignee').notNull(),
  tags: text('tags').notNull(),
  searchText: text('search_text').notNull(),
  meetingId: text('meeting_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const decisions = sqliteTable('decisions', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id').notNull(),
  content: text('content').notNull(),
  position: integer('position').notNull(),
})

export const actionItems = sqliteTable('action_items', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id').notNull(),
  taskId: text('task_id'),
  content: text('content').notNull(),
  assignee: text('assignee').notNull(),
  dueDate: text('due_date'),
  position: integer('position').notNull(),
})

export const settings = sqliteTable('settings', {
  settingKey: text('key').primaryKey(),
  value: text('value').notNull(),
})
