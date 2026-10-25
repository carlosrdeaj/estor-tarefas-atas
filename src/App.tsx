import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { DashboardPage } from "./pages/DashboardPage";
import { MeetingDetailPage } from "./pages/MeetingDetailPage";
import { MeetingFormPage } from "./pages/MeetingFormPage";
import { MeetingsPage } from "./pages/MeetingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TasksPage } from "./pages/TasksPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="tarefas" element={<TasksPage />} />
          <Route path="reunioes" element={<MeetingsPage />} />
          <Route path="reunioes/nova" element={<MeetingFormPage />} />
          <Route path="reunioes/:id" element={<MeetingDetailPage />} />
          <Route path="reunioes/:id/editar" element={<MeetingFormPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
