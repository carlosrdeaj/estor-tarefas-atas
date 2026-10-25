import express, { type NextFunction, type Request, type Response } from 'express'
import { initDatabase } from './db'
import { HttpError } from './errors'
import { downloadName, meetingToMarkdown, meetingToPdf } from './export'
import {
  createMeeting,
  createTask,
  deleteMeeting,
  deleteTask,
  getDashboard,
  getMeeting,
  getTask,
  listMeetings,
  listTasks,
  seedIfNeeded,
  updateMeeting,
  updateTask,
} from './store'
import { parseMeetingDraft, parseMeetingQuery, parseTaskCreate, parseTaskPatch, parseTaskQuery } from './validate'

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

function queryOf(req: Request): Record<string, unknown> {
  return req.query as Record<string, unknown>
}

export function createApp(options?: { dbPath?: string; seed?: boolean }) {
  initDatabase({ dbPath: options?.dbPath })
  if (options?.seed ?? process.env.NODE_ENV !== 'test') seedIfNeeded()

  const app = express()
  app.disable('x-powered-by')
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'same-origin')
    next()
  })
  app.use(express.json({ limit: '1mb' }))
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/dashboard', (_req, res) => {
    res.json(getDashboard())
  })

  app.get('/api/tasks', (req, res) => {
    res.json(listTasks(parseTaskQuery(queryOf(req))))
  })

  app.post(
    '/api/tasks',
    asyncRoute(async (req, res) => {
      res.status(201).json(createTask(parseTaskCreate(req.body)))
    }),
  )

  app.get('/api/tasks/:id', (req, res) => {
    const task = getTask(req.params.id)
    if (!task) throw new HttpError(404, 'Tarefa não encontrada.')
    res.json(task)
  })

  app.patch('/api/tasks/:id', (req, res) => {
    res.json(updateTask(req.params.id, parseTaskPatch(req.body)))
  })

  app.delete('/api/tasks/:id', (req, res) => {
    deleteTask(req.params.id)
    res.status(204).end()
  })

  app.get('/api/meetings', (req, res) => {
    res.json(listMeetings(parseMeetingQuery(queryOf(req))))
  })

  app.post('/api/meetings', (req, res) => {
    res.status(201).json(createMeeting(parseMeetingDraft(req.body)))
  })

  app.get('/api/meetings/:id', (req, res) => {
    const meeting = getMeeting(req.params.id)
    if (!meeting) throw new HttpError(404, 'Ata não encontrada.')
    res.json(meeting)
  })

  app.put('/api/meetings/:id', (req, res) => {
    res.json(updateMeeting(req.params.id, parseMeetingDraft(req.body)))
  })

  app.delete('/api/meetings/:id', (req, res) => {
    deleteMeeting(req.params.id)
    res.status(204).end()
  })

  app.get(
    '/api/meetings/:id/markdown',
    asyncRoute(async (req, res) => {
      const meeting = getMeeting(req.params.id)
      if (!meeting) throw new HttpError(404, 'Ata não encontrada.')
      const filename = downloadName(meeting.title, 'md')
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(meetingToMarkdown(meeting))
    }),
  )

  app.get(
    '/api/meetings/:id/pdf',
    asyncRoute(async (req, res) => {
      const meeting = getMeeting(req.params.id)
      if (!meeting) throw new HttpError(404, 'Ata não encontrada.')
      const filename = downloadName(meeting.title, 'pdf')
      const pdf = await meetingToPdf(meeting)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(pdf)
    }),
  )

  // Resumo por IA e importação de calendário ficam em server/extensions.ts.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Recurso não encontrado.' })
  })

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return
    const parseFailed =
      error instanceof SyntaxError &&
      'type' in error &&
      (error as { type?: string }).type === 'entity.parse.failed'
    if (parseFailed) {
      res.status(400).json({ error: 'JSON inválido.' })
      return
    }
    const status = error instanceof HttpError ? error.status : 500
    const message = error instanceof HttpError ? error.message : 'Erro interno do servidor.'
    if (status >= 500) console.error(error)
    if (req.path.startsWith('/api')) {
      res.status(status).json({ error: message })
      return
    }
    res.status(status).type('text/plain; charset=utf-8').send(message)
  })

  return app
}
