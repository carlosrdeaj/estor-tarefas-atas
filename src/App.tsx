import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { MeetingPage } from './pages/MeetingPage'
import { MeetingsPage } from './pages/MeetingsPage'
import { TasksPage } from './pages/TasksPage'

function NotFound() {
  return (
    <div className="empty">
      <h1>Página não encontrada</h1>
      <p>Esse endereço não leva a uma tarefa nem a uma ata.</p>
      <Link className="btn primary" to="/">
        Voltar ao painel
      </Link>
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="tarefas" element={<TasksPage />} />
          <Route path="tarefas/:taskId" element={<TasksPage />} />
          <Route path="reunioes" element={<MeetingsPage />} />
          <Route path="reunioes/nova" element={<MeetingPage />} />
          <Route path="reunioes/:meetingId" element={<MeetingPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
