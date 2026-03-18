// Main App component with routing
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Pages
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import TradesPage from "./pages/Trades";
import StrategyPage from "./pages/Strategy";
import UploadPage from "./pages/Upload";
import SettingsPage from "./pages/Settings";
import DayWisePage from "./pages/DayWise";
import BacktestingPage from "./pages/Backtesting";

// Components
import Layout from "./components/Layout";

// Hooks
import { useAuth } from "./hooks/useAuth";

// Styles
import "./styles/global.css";

// Protected Route Component
const ProtectedRoute = ({ isAuthenticated, children }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : true; // Default to dark mode
  });

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.body.classList.remove("light-mode");
    } else {
      document.body.classList.add("light-mode");
    }
  }, [darkMode]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Layout
                  darkMode={darkMode}
                  toggleDarkMode={() => setDarkMode(!darkMode)}
                >
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/trades"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Layout
                  darkMode={darkMode}
                  toggleDarkMode={() => setDarkMode(!darkMode)}
                >
                  <TradesPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/strategy"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Layout
                  darkMode={darkMode}
                  toggleDarkMode={() => setDarkMode(!darkMode)}
                >
                  <StrategyPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/upload"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Layout
                  darkMode={darkMode}
                  toggleDarkMode={() => setDarkMode(!darkMode)}
                >
                  <UploadPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Layout
                  darkMode={darkMode}
                  toggleDarkMode={() => setDarkMode(!darkMode)}
                >
                  <SettingsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/daywise"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Layout
                  darkMode={darkMode}
                  toggleDarkMode={() => setDarkMode(!darkMode)}
                >
                  <DayWisePage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/backtesting"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Layout
                  darkMode={darkMode}
                  toggleDarkMode={() => setDarkMode(!darkMode)}
                >
                  <BacktestingPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Toast notifications */}
        <Toaster position="top-right" />
      </div>
    </BrowserRouter>
  );
}

export default App;
