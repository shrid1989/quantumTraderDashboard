// Layout component with Header and Sidebar
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FiMenu, FiX, FiLogOut, FiMoon, FiSun } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import "../styles/layout.css";

function Layout({ children, darkMode, toggleDarkMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="layout">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button
            className="menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
          <h1 className="logo">⚛️ QuantumTrader</h1>
        </div>

        <div className="header-right">
          <button
            className="theme-btn"
            onClick={toggleDarkMode}
            title="Toggle dark mode"
          >
            {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
          </button>

          <div className="user-info">
            <span className="user-email">{user?.email}</span>
            <button className="btn btn-danger" onClick={handleLogout}>
              <FiLogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="layout-body">
        {/* Mobile overlay backdrop */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <nav className="nav-menu">
            <Link
              to="/"
              className={`nav-item ${isActive("/") ? "active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              📊 Dashboard
            </Link>
            <Link
              to="/trades"
              className={`nav-item ${isActive("/trades") ? "active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              📋 Trades
            </Link>
            <Link
              to="/strategy"
              className={`nav-item ${isActive("/strategy") ? "active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              🎯 Strategy
            </Link>
            <Link
              to="/upload"
              className={`nav-item ${isActive("/upload") ? "active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              📤 Upload
            </Link>
            <Link
              to="/settings"
              className={`nav-item ${isActive("/settings") ? "active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              ⚙️ Settings
            </Link>
            <Link
              to="/daywise"
              className={`nav-item ${isActive("/daywise") ? "active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              📅 Day Wise
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

export default Layout;
