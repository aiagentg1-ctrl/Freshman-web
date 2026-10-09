"use client";

import { useState, useEffect } from "react";

/**
 * Development helper to set a test user ID for testing XP and leaderboard
 * This is only shown in development mode or when accessed via URL param
 */
export function DevUserSetup() {
  const [userId, setUserId] = useState("");
  const [saved, setSaved] = useState(false);
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== "undefined") {
      setCurrentTestId(localStorage.getItem("freshoTestUserId"));
      setIsVisible(window.location.search.includes("debug=true"));
    }
  }, []);

  const handleSave = () => {
    const id = Number(userId);
    if (id > 0) {
      localStorage.setItem("freshoTestUserId", String(id));
      setCurrentTestId(String(id));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      console.log(`✅ Test user ID set to: ${id}`);
    }
  };

  const handleClear = () => {
    localStorage.removeItem("freshoTestUserId");
    setUserId("");
    setCurrentTestId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    console.log("✅ Test user ID cleared");
  };

  // Don't render anything if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <div style={{
      position: "fixed",
      top: "10px",
      right: "10px",
      background: "#1a1a1a",
      color: "#fff",
      padding: "15px",
      borderRadius: "8px",
      zIndex: 9999,
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      minWidth: "250px",
      fontFamily: "monospace",
      fontSize: "12px"
    }}>
      <div style={{ marginBottom: "10px", fontWeight: "bold", color: "#00ff00" }}>
        🔧 Dev Mode: Test User Setup
      </div>
      <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>
          Current Test ID: <span style={{ color: "#00ffff" }}>{currentTestId || "None"}</span>
        </label>
        <input
          type="number"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Enter test user ID"
          style={{
            width: "100%",
            padding: "5px",
            background: "#333",
            border: "1px solid #555",
            color: "#fff",
            borderRadius: "4px"
          }}
        />
      </div>
      <div style={{ display: "flex", gap: "5px" }}>
        <button
          onClick={handleSave}
          disabled={!userId}
          style={{
            flex: 1,
            padding: "5px",
            background: "#00ff00",
            color: "#000",
            border: "none",
            borderRadius: "4px",
            cursor: userId ? "pointer" : "not-allowed",
            opacity: userId ? 1 : 0.5
          }}
        >
          {saved ? "✓ Saved" : "Set ID"}
        </button>
        <button
          onClick={handleClear}
          style={{
            flex: 1,
            padding: "5px",
            background: "#ff4444",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Clear
        </button>
      </div>
      <div style={{ marginTop: "10px", fontSize: "10px", color: "#888" }}>
        Add ?debug=true to URL to see this
      </div>
    </div>
  );
}
