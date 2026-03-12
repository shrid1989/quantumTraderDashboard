// Settings Page
import React from "react";
import { useAuth } from "../hooks/useAuth";

function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="settings-page">
      <h1>⚙️ Settings</h1>

      <div className="settings-card">
        <h2>👤 User Information</h2>
        <p>
          <strong>Email:</strong> {user?.email}
        </p>
        <p>
          <strong>Role:</strong> Trader
        </p>
      </div>

      <div className="settings-card">
        <h2>🚀 About</h2>
        <p>
          <strong>App:</strong> QuantumTrader Dashboard
        </p>
        <p>
          <strong>Version:</strong> 2.0.0
        </p>
        <p>
          <strong>Backend:</strong> FastAPI on Render
        </p>
        <p>
          <strong>Database:</strong> Supabase (PostgreSQL)
        </p>
        <p>
          <strong>Frontend:</strong> React on Vercel
        </p>
      </div>

      <div className="settings-card">
        <h2>📊 Data</h2>
        <p>
          <strong>Exchange:</strong> NSE (NIFTY Options)
        </p>
        <p>
          <strong>Source:</strong> CSV upload / S3 Lambda sync
        </p>
      </div>
    </div>
  );
}

export default SettingsPage;
