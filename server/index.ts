import { existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import { createApp } from './app'

function attachProductionFrontend(app: Express) {
  const dist = path.resolve(process.cwd(), 'dist')
  const indexFile = path.join(dist, 'index.html')
  if (!existsSync(indexFile)) {
    console.warn('Pasta dist/ não encontrada. Rode npm run build antes de npm start.')
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) return next()
      res
        .status(503)
        .type('text/plain; charset=utf-8')
        .send('Interface ainda não foi gerada. Execute npm run build.')
    })
    return
  }

  app.use(express.static(dist, { index: false, maxAge: '1h' }))
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api')) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(indexFile, (error) => {
      if (error) next(error)
    })
  })
}

async function attachDevFrontend(app: Express, server: http.Server) {
  const { createServer } = await import('vite')
  const vite = await createServer({
    server: {
      middlewareMode: true,
      hmr: process.env.REPL_ID
        ? { server, protocol: 'wss', clientPort: 443 }
        : { server },
    },
    appType: 'spa',
  })
  app.use(vite.middlewares)
}

const port = Number(process.env.PORT) || 5000
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error('A variável PORT precisa ser um número entre 1 e 65535.')
  process.exit(1)
}

const app = createApp()
const server = http.createServer(app)

if (process.env.NODE_ENV === 'production') attachProductionFrontend(app)
else await attachDevFrontend(app, server)

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${port} já está em uso.`)
    process.exit(1)
  }
  console.error(error)
  process.exit(1)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Pauta está no ar em http://0.0.0.0:${port}`)
})
