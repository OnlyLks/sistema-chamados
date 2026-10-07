import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/logo.png';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const temaAlternativo = theme === 'dark' ? 'claro' : 'escuro';

  if (user?.tipo === 'tecnico') {
    const nome = user.nome_exibicao || user.nome;

    return (
      <div className="technician-layout">
        <aside className="sidebar" aria-label="Navegação principal">
          <div className="sidebar-brand">
            <img className="sidebar-brand-logo" src={logo} alt="Nome" />
            <div>
              <strong>Painel T.I.</strong>
              <span>Sistema de chamados</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <span className="sidebar-label">Atendimento</span>
            <NavLink
              to="/tecnico"
              end
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span aria-hidden="true">▣</span>
              Atendimentos
            </NavLink>

            {user.admin && (
              <>
                <span className="sidebar-label">Administração</span>
                <NavLink
                  to="/admin/tecnicos"
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <span aria-hidden="true">👥</span>
                  Gerenciar técnicos
                </NavLink>
                <NavLink
                  to="/admin/auditoria"
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <span aria-hidden="true">▤</span>
                  Auditoria e dados
                </NavLink>
              </>
            )}
          </nav>

          <div className="sidebar-footer">
            <button className="theme-toggle sidebar-theme-toggle" onClick={toggleTheme} aria-label={`Ativar tema ${temaAlternativo}`}>
              <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
              Tema {temaAlternativo}
            </button>
            <div className="sidebar-user" title={nome}>
              <span className="sidebar-avatar" aria-hidden="true">{nome?.charAt(0).toUpperCase()}</span>
              <div>
                <strong>{nome}</strong>
                <span>{user.admin ? 'Administrador' : 'Técnico'}</span>
              </div>
            </div>
            <button className="sidebar-logout" onClick={logout}>
              <span aria-hidden="true">↩</span>
              Sair do sistema
            </button>
          </div>
        </aside>
        <main className="technician-main">{children}</main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="topbar-container">
        <div className="topbar-brand">
          <h2>
            <img className="topbar-logo" src={logo} alt="Nome" />
            {user?.tipo === 'colaborador' ? 'Portal Colaborador' : 'Painel T.I'}
          </h2>
        </div>
        <div className="topbar-user-section">
          <div className="topbar-user-info">
            <span className="label">Usuário : </span>
            <span className="value">{user?.nome_exibicao || user?.nome}</span>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} aria-label={`Ativar tema ${temaAlternativo}`}>
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            Tema {temaAlternativo}
          </button>
          <button className="btn-sair" onClick={logout}>↩ Sair</button>
        </div>
      </div>
      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
