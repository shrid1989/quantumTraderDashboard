// CSV Upload Page
import React, { useState, useRef } from "react";
import { uploadAPI } from "../services/api";
import toast from "react-hot-toast";

function UploadPage() {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (selectedFile) => {
    if (selectedFile && selectedFile.name.endsWith(".csv")) {
      setFile(selectedFile);
    } else if (selectedFile) {
      toast.error("Please select a CSV file");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    handleFileChange(dropped);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a CSV file first");
      return;
    }

    setIsLoading(true);
    try {
      const response = await uploadAPI.uploadCSV(file);
      toast.success(
        `✅ Uploaded ${response.data.trades_added} trades successfully!`,
      );
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="upload-page">
      <h1>📤 Upload Trades</h1>

      <form onSubmit={handleUpload}>
        {/* Drop Zone */}
        <div
          className={`upload-card ${dragOver ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="upload-icon">📁</span>
          <h3>Drop your CSV file here</h3>
          <p>or click to browse files from your computer</p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="upload-file-input"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
            disabled={isLoading}
          />

          <label
            className="upload-file-label"
            onClick={(e) => e.stopPropagation()}
          >
            📂 Browse Files
          </label>

          {file && (
            <div
              className="upload-selected-file"
              onClick={(e) => e.stopPropagation()}
            >
              <span>📄</span>
              <span>{file.name}</span>
              <span
                style={{
                  marginLeft: "auto",
                  color: "var(--text-secondary)",
                  fontSize: "0.8rem",
                }}
              >
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="upload-submit-btn"
          disabled={isLoading || !file}
        >
          {isLoading ? "⏳ Uploading..." : "🚀 Upload Trades CSV"}
        </button>
      </form>

      {/* Format hint */}
      <div className="upload-format-hint">
        <h4>📋 Expected CSV Columns</h4>
        <p>
          date, nifty_value, strategy, entry_reason, option_strike, sold_option,
          position_type, entry_time, entry_premium, exit_time, exit_premium,
          exit_reason, quantity, pnl
        </p>
      </div>
    </div>
  );
}

export default UploadPage;
