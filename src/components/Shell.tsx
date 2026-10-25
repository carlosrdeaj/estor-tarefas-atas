import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="8" width="16" height="16" rx="4" />
      <rect x="14" y="8" width="16" height="16" rx="4" />
    </svg>
  );
}

function readTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function Shell() {
  const [theme, setTheme] = useState<"light" | "dark">(readTheme);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("nexo-theme", next);
    setTheme(next);
  }

  return (
    <div className="shell">
      <a className="skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="brand" end>
          <Logo />
          <span>
            <strong>Nexo</strong>
            <small>Tarefas e atas</small>
          </span>
        </NavLink>
        <nav className="nav" aria-label="Principal">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Painel
          </NavLink>
          <NavLink to="/tarefas" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Tarefas
          </NavLink>
          <NavLink to="/reunioes" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Atas
          </NavLink>
        </nav>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-pressed={theme === "dark"}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          {theme === "dark" ? "Modo claro" : "Modo escuro"}
        </button>
      </aside>
      <main id="conteudo" className="content">
        <Outlet />
      </main>
    </div>
  );
}
