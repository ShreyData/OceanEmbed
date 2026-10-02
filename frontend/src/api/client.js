// OceanEmbed API Client
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7860';

// ── Global window store (survives HMR, no size limits, no module boundary issues) ──
// sessionStorage: fails silently at 6.5 MB (5 MB quota)
// React Router state: fails silently at 6.5 MB (History API ~640KB–2MB browser limit)
// Module-level variable: wiped on Vite HMR re-evaluation
// SOLUTION: window object — always the same global, no size limits, survives routing

export function setLastResult(data) {
  window.__OCEAN_RESULT__ = data;
}

export function getLastResult() {
  return window.__OCEAN_RESULT__ || null;
}

export function clearLastResult() {
  window.__OCEAN_RESULT__ = null;
}

// ── API Calls ──────────────────────────────────────────────────────────────
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Backend unavailable');
  return res.json();
}

export async function predictFromNC(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);
  // Store on window immediately (before navigate is called)
  setLastResult(data);
  return data;
}
