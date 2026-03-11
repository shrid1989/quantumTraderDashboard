// CSV Upload Page
import React, { useState } from "react";
import { uploadAPI } from "../services/api";
import toast from "react-hot-toast";

function UploadPage() {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setIsLoading(true);
    try {
      const response = await uploadAPI.uploadCSV(file);
      toast.success(`Uploaded ${response.data.trades_added} trades`);
      setFile(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="upload-page">
      <h1>📤 Upload CSV</h1>
      <form onSubmit={handleUpload} className="upload-form">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0])}
          disabled={isLoading}
        />
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? "Uploading..." : "Upload"}
        </button>
      </form>
    </div>
  );
}

export default UploadPage;
