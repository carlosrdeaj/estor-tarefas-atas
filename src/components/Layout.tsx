import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { cx } from '../format'

function readTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function ThemeToggle({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  return (
    <button type="button" className="btn theme-btn" onClick={onToggle} aria-pressed={theme === 'dark'}>
      {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
    </button>
  )
}

function navClass({ isActive }: { isActive: boolean }) {
  return cx('nav-link', isActive && 'active')
}

export function Layout() {
  const [theme, setTheme] = useState<'light' | 'dark'>(readTheme)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#141210' : '#efeae2')
    try {
      localStorage.setItem('pauta-theme', next)
    } catch {
      // O modo continua valendo nesta visita mesmo se o navegador bloquear o armazenamento.
    }
  }

  return (
    <div className="app-shell">
      <a className="skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="brand" end>
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span>
            <strong className="brand-name">Pauta</strong>
            <small>Tarefas e atas</small>
          </span>
        </NavLink>
        <nav className="side-nav" aria-label="Principal">
          <NavLink to="/" className={navClass} end>
            Painel
          </NavLink>
          <NavLink to="/tarefas" className={navClass}>
            Tarefas
          </NavLink>
          <NavLink to="/reunioes" className={navClass}>
            Reuniões
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <NavLink to="/" className="brand-name compact" end>
            Pauta
          </NavLink>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </header>
        <main id="conteudo" className="content">
          <Outlet />
        </main>
      </div>
      <nav className="tabbar" aria-label="Principal">
        <NavLink to="/" className={navClass} end>
          Painel
        </NavLink>
        <NavLink to="/tarefas" className={navClass}>
          Tarefas
        </NavLink>
        <NavLink to="/reunioes" className={navClass}>
          Reuniões
        </NavLink>
      </nav>
    </div>
  )
}
