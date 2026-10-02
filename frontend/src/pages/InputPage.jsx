import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { predictFromNC } from '../api/client';

const REQUIRED_VARS = ['analysed_sst', 'sos', 'sla', 'uwnd', 'vwnd', 'u', 'v'];

const STEP_MESSAGES = [
  'Parsing 11-Day Spatiotemporal Tensor…',
  'Applying surface ocean mask…',
  'Normalising feature channels…',
  'Running OceanEmbed Neural Reconstruction…',
  'Decoding 15 depth levels…',
];

export default function InputPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  /* ── File validation ─────────────────────────────────────────────────── */
  const handleFile = useCallback((f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.nc')) {
      setErrorMsg('Only NetCDF (.nc) files are accepted.');
      setStatus('error');
      return;
    }
    setFile(f);
    setErrorMsg('');
    setStatus('idle');
  }, []);

  /* ── Drag & drop ────────────────────────────────────────────────────── */
  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  /* ── Load demo file ─────────────────────────────────────────────────── */
  const loadDemo = async () => {
    try {
      setErrorMsg('');
      const res = await fetch('/demo_ocean_11day.nc');
      if (!res.ok) throw new Error('Demo file not found. Make sure frontend/public/demo_ocean_11day.nc exists.');
      const blob = await res.blob();
      const demoFile = new File([blob], 'demo_north_indian_ocean_jan2022.nc', {
        type: 'application/x-netcdf',
      });
      handleFile(demoFile);
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  /* ── Run prediction ─────────────────────────────────────────────────── */
  const handleRun = async () => {
    if (!file) {
      setErrorMsg('Please upload a NetCDF file first.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    // Simulate step-by-step progress messages
    let step = 0;
    setLoadingStep(0);
    const stepTimer = setInterval(() => {
      step = Math.min(step + 1, STEP_MESSAGES.length - 1);
      setLoadingStep(step);
    }, 900);

    try {
      const result = await predictFromNC(file);
      clearInterval(stepTimer);
      window.__PREDICTION_RESULT__ = result;
      try {
        sessionStorage.setItem('oceanembed_last_prediction', JSON.stringify(result));
      } catch (e) {}
      navigate('/results', { state: { prediction: result } });
    } catch (err) {
      clearInterval(stepTimer);
      setErrorMsg(err.message || 'Prediction failed. Check the backend server.');
      setStatus('error');
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /* ── Loading screen ─────────────────────────────────────────────────── */
  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
        <div style={{ fontSize: 56 }}>🌊</div>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>OceanEmbed Inference Running</h2>
        <div style={{
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: '24px 40px', minWidth: 380, textAlign: 'center'
        }}>
          {STEP_MESSAGES.map((msg, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
              opacity: i <= loadingStep ? 1 : 0.3,
              transition: 'opacity 0.4s ease',
            }}>
              <span style={{ fontSize: 18 }}>
                {i < loadingStep ? '✅' : i === loadingStep ? '⏳' : '⬜'}
              </span>
              <span style={{ fontSize: '0.9rem' }}>{msg}</span>
            </div>
          ))}
        </div>
        <p style={{ color: 'var(--color-slate-light)', fontSize: '0.85rem' }}>
          CPU inference typically completes in 500–900 ms
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '2rem', margin: '0 0 8px 0' }}>Upload 11-Day Surface Observation Matrix</h1>
        <p style={{ color: 'var(--color-slate-light)', margin: 0 }}>
          Provide 11 consecutive days of multi-variable surface ocean observations for 3D subsurface reconstruction.
        </p>
      </div>

      {/* Error banner */}
      {status === 'error' && errorMsg && (
        <div style={{
          background: '#fff1f0', border: '1px solid #ffa39e',
          borderRadius: 8, padding: '14px 18px', color: '#a8071a',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <div>
            <strong>Validation Error</strong>
            <br />
            <span style={{ fontSize: '0.9rem' }}>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--color-primary)' : file ? '#52c41a' : 'var(--color-border)'}`,
          borderRadius: 12,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragging ? 'rgba(0,120,200,0.04)' : file ? 'rgba(82,196,26,0.04)' : 'var(--color-off-white)',
          transition: 'all 0.2s ease',
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".nc"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div style={{ fontSize: 48, marginBottom: 12 }}>{file ? '✅' : '📂'}</div>
        {file ? (
          <>
            <h3 style={{ margin: '0 0 6px 0', color: '#389e0d' }}>{file.name}</h3>
            <p style={{ margin: 0, color: 'var(--color-slate-light)', fontSize: '0.875rem' }}>
              {formatSize(file.size)} · NetCDF file · Click to replace
            </p>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 8px 0' }}>Drop your .nc file here</h3>
            <p style={{ margin: 0, color: 'var(--color-slate-light)', fontSize: '0.875rem' }}>
              or click to browse — only NetCDF (.nc) files accepted
            </p>
          </>
        )}
      </div>

      {/* Demo button */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={loadDemo}
          style={{
            background: 'none', border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)', borderRadius: 8, padding: '10px 24px',
            cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => e.target.style.background = 'var(--color-primary-light)'}
          onMouseLeave={e => e.target.style.background = 'none'}
        >
          🌐 Load Demo Sample (North Indian Ocean, Jan 1–11 2022)
        </button>
      </div>

      {/* Spec card */}
      <div style={{
        background: 'var(--color-card)', border: '1px solid var(--color-border)',
        borderRadius: 12, padding: 24,
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>📋 NetCDF File Requirements</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px', fontSize: '0.875rem' }}>
          <div>
            <div style={{ color: 'var(--color-slate-light)', marginBottom: 4 }}>Required Variables (7)</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.8 }}>
              {REQUIRED_VARS.map(v => <div key={v}>• {v}</div>)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ color: 'var(--color-slate-light)', marginBottom: 2 }}>Time Steps</div>
              <strong>Exactly 11 days</strong> (days 1–10 = history, day 11 = prediction target)
            </div>
            <div>
              <div style={{ color: 'var(--color-slate-light)', marginBottom: 2 }}>Spatial Grid</div>
              <strong>100 × 240</strong> (lat × lon, 0.25° resolution)
            </div>
            <div>
              <div style={{ color: 'var(--color-slate-light)', marginBottom: 2 }}>Coverage</div>
              <strong>5.0°N – 29.75°N</strong> | <strong>45.0°E – 104.75°E</strong>
            </div>
            <div>
              <div style={{ color: 'var(--color-slate-light)', marginBottom: 2 }}>Region</div>
              North Indian Ocean (Arabian Sea + Bay of Bengal)
            </div>
          </div>
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={!file}
        style={{
          background: file ? 'var(--color-primary)' : '#d9d9d9',
          color: file ? '#fff' : '#999',
          border: 'none', borderRadius: 10, padding: '16px',
          fontSize: '1.05rem', fontWeight: 600, cursor: file ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease', letterSpacing: '0.02em',
        }}
      >
        🔬 Run OceanEmbed Model — Reconstruct 3D Temperature Field
      </button>
    </div>
  );
}
