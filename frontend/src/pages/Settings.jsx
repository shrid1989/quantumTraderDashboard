// Settings Page
import React from "react";
import { useAuth } from "../hooks/useAuth";

function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="settings-page">
      <h1>⚙️ Settings</h1>
      <div className="settings-card">
        <h2>User Information</h2>
        <p>
          <strong>Email:</strong> {user?.email}
        </p>
      </div>
      <div className="settings-card">
        <h2>About</h2>
        <p>
          <strong>App:</strong> QuantumTrader Dashboard
        </p>
        <p>
          <strong>Version:</strong> 1.0.0
        </p>
        <p>
          <strong>API:</strong> FastAPI with DynamoDB
        </p>
      </div>
    </div>
  );
}

export default SettingsPage;
