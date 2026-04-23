import React from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { Cloud, List, ExternalLink } from 'lucide-react';

export const Layout: React.FC = () => {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo-section">
          <Cloud className="logo-icon" />
          <span className="logo-text">Mavrick Cloud</span>
        </div>
        <nav className="nav-menu">
          <Link to="/" className="nav-item" activeProps={{ className: 'active' }}>
            <List size={20} />
            <span>Deployments</span>
          </Link>
          <a href="https://github.com/debelistic/mavrick-cloud" target="_blank" rel="noreferrer" className="nav-item">
            <ExternalLink size={20} />
            <span>Repository</span>
          </a>
        </nav>
      </aside>
      <main className="main-content">
        <header className="top-bar">
          <h1>Dashboard</h1>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
