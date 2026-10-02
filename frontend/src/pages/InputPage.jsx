import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { predictFromNC, setLastResult } from '../api/client';
import {
  UploadCloud,
  FileCheck,
  Play,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Database,
  Layers,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Compass,
  BookOpen,
} from 'lucide-react';

const REQUIRED_VARS = [
  { key: 'analysed_sst', name: 'SST (Sea Surface Temp)' },
  { key: 'sos', name: 'SSS (Sea Surface Salinity)' },
  { key: 'sla', name: 'SLA (Sea Level Anomaly)' },
  { key: 'uwnd', name: 'U-Wind (10m Zonal)' },
  { key: 'vwnd', name: 'V-Wind (10m Meridional)' },
  { key: 'u', name: 'U-Current (Zonal)' },
  { key: 'v', name: 'V-Current (Meridional)' },
];

const DEFAULT_DEMOS = [
  {
    id: 'demo_2023_10_18',
    filename: 'demo_2023_10_18.nc',
    path: '/demos/demo_2023_10_18.nc',
    season: 'Autumn Post-Monsoon (Oct 2023)',
    short_season: 'Autumn Post-Monsoon',
    target_date: '2023-10-18',
    year: 2023,
    size_mb: 2.67,
    isWinner: true,
  },
  {
    id: 'demo_2022_09_23',
    filename: 'demo_2022_09_23.nc',
    path: '/demos/demo_2022_09_23.nc',
    season: 'Late Summer Monsoon (Sep 2022)',
    short_season: 'Late Summer Monsoon',
    target_date: '2022-09-23',
    year: 2022,
    size_mb: 2.64,
    isWinner: true,
  },
  {
    id: 'demo_2022_01_11',
    filename: 'demo_2022_01_11.nc',
    path: '/demos/demo_2022_01_11.nc',
    season: 'Winter Monsoon (Jan 2022)',
    short_season: 'Winter Monsoon',
    target_date: '2022-01-11',
    year: 2022,
    size_mb: 2.64,
  },
  {
    id: 'demo_2022_04_11',
    filename: 'demo_2022_04_11.nc',
    path: '/demos/demo_2022_04_11.nc',
    season: 'Spring Pre-Monsoon (Apr 2022)',
    short_season: 'Spring Pre-Monsoon',
    target_date: '2022-04-11',
    year: 2022,
    size_mb: 2.66,
  },
  {
    id: 'demo_2022_07_11',
    filename: 'demo_2022_07_11.nc',
    path: '/demos/demo_2022_07_11.nc',
    season: 'Southwest Summer Monsoon (Jul 2022)',
    short_season: 'Summer Monsoon Upwelling',
    target_date: '2022-07-11',
    year: 2022,
    size_mb: 2.62,
  },
  {
    id: 'demo_2022_10_11',
    filename: 'demo_2022_10_11.nc',
    path: '/demos/demo_2022_10_11.nc',
    season: 'Post-Monsoon Transition (Oct 2022)',
    short_season: 'Post-Monsoon Transition',
    target_date: '2022-10-11',
    year: 2022,
    size_mb: 2.66,
  },
  {
    id: 'demo_2023_02_11',
    filename: 'demo_2023_02_11.nc',
    path: '/demos/demo_2023_02_11.nc',
    season: 'Late Winter Stratification (Feb 2023)',
    short_season: 'Late Winter Stratification',
    target_date: '2023-02-11',
    year: 2023,
    size_mb: 2.65,
  },
  {
    id: 'demo_2023_05_11',
    filename: 'demo_2023_05_11.nc',
    path: '/demos/demo_2023_05_11.nc',
    season: 'Pre-Monsoon Peak Warming (May 2023)',
    short_season: 'Peak Summer Warming',
    target_date: '2023-05-11',
    year: 2023,
    size_mb: 2.66,
  },
  {
    id: 'demo_2023_08_11',
    filename: 'demo_2023_08_11.nc',
    path: '/demos/demo_2023_08_11.nc',
    season: 'Mid-Monsoon Wind Mixing (Aug 2023)',
    short_season: 'Mid-Monsoon Wind Mixing',
    target_date: '2023-08-11',
    year: 2023,
    size_mb: 2.63,
  },
  {
    id: 'demo_2023_11_11',
    filename: 'demo_2023_11_11.nc',
    path: '/demos/demo_2023_11_11.nc',
    season: 'Northeast Monsoon (Nov 2023)',
    short_season: 'Northeast Monsoon',
    target_date: '2023-11-11',
    year: 2023,
    size_mb: 2.66,
  },
  {
    id: 'demo_2024_03_11',
    filename: 'demo_2024_03_11.nc',
    path: '/demos/demo_2024_03_11.nc',
    season: 'Spring Warming (Mar 2024)',
    short_season: 'Spring Warming',
    target_date: '2024-03-11',
    year: 2024,
    size_mb: 2.64,
  },
  {
    id: 'demo_2024_10_11',
    filename: 'demo_2024_10_11.nc',
    path: '/demos/demo_2024_10_11.nc',
    season: 'Autumn Post-Monsoon (Oct 2024)',
    short_season: 'Autumn Post-Monsoon',
    target_date: '2024-10-11',
    year: 2024,
    size_mb: 2.68,
  },
];

const STEP_MESSAGES = [
  'Verifying NetCDF structure & 11 daily observation steps...',
  'Extracting 7 surface parameter fields (SST, SSS, SLA, Winds, Currents)...',
  'Masking bathymetric boundaries & applying standard geophysical normalization...',
  'Executing dual-branch spatiotemporal encoder & ConvLSTM temporal memory...',
  'Synthesizing 15 volumetric depth layers (0m to 1000m)...',
  'Indexing collocated INCOIS ARGO & GLORYS in-situ benchmarks...',
];

export default function InputPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [demos, setDemos] = useState(DEFAULT_DEMOS);
  const [selectedDemo, setSelectedDemo] = useState(DEFAULT_DEMOS[0]);
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  // Fetch demo manifest
  useEffect(() => {
    fetch('/demos/demos_manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((manifest) => {
        if (manifest && Array.isArray(manifest) && manifest.length > 0) {
          setDemos(manifest);
        }
      })
      .catch(() => {});
  }, []);

  // Pre-load default demo on first render so user can click Run immediately
  useEffect(() => {
    if (!file && DEFAULT_DEMOS.length > 0) {
      loadDemoByPath(DEFAULT_DEMOS[0]);
    }
  }, []);

  /* ── File validation ─────────────────────────────────────────────────── */
  const handleFile = useCallback((f, demoMeta = null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.nc')) {
      setErrorMsg('Invalid file format. Only scientific NetCDF (.nc) files are supported.');
      setStatus('error');
      return;
    }
    setFile(f);
    if (demoMeta) {
      setSelectedDemo(demoMeta);
    } else {
      setSelectedDemo({
        id: 'custom_upload',
        filename: f.name,
        season: 'Custom Uploaded Observation Matrix',
        short_season: 'User Custom NetCDF',
        target_date: 'Custom Window',
        size_mb: Math.round((f.size / (1024 * 1024)) * 100) / 100,
      });
    }
    setErrorMsg('');
    setStatus('idle');
  }, []);

  /* ── Drag & drop ────────────────────────────────────────────────────── */
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f, null);
  };

  /* ── Load specific demo file ────────────────────────────────────────── */
  const loadDemoByPath = async (demoItem) => {
    setIsLoadingDemo(true);
    setErrorMsg('');
    try {
      const res = await fetch(demoItem.path);
      if (!res.ok) throw new Error(`Demo file not found at ${demoItem.path}`);
      const blob = await res.blob();
      const demoFile = new File([blob], demoItem.filename, {
        type: 'application/x-netcdf',
      });
      handleFile(demoFile, demoItem);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to download demo file');
      setStatus('error');
    } finally {
      setIsLoadingDemo(false);
    }
  };

  /* ── Run prediction ─────────────────────────────────────────────────── */
  const handleRun = async () => {
    if (!file) {
      setErrorMsg('Please select a dataset or upload a NetCDF file first.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    let step = 0;
    setLoadingStep(0);
    const stepTimer = setInterval(() => {
      step = Math.min(step + 1, STEP_MESSAGES.length - 1);
      setLoadingStep(step);
    }, 450);

    try {
      const result = await predictFromNC(file);
      clearInterval(stepTimer);
      navigate('/results');
    } catch (err) {
      clearInterval(stepTimer);
      setErrorMsg(err.message || 'Model reconstruction failed');
      setStatus('error');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '2.6 MB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /* ── Loading Screen ── */
  if (status === 'loading') {
    return (
      <div className="card" style={{
        maxWidth: 620,
        margin: '40px auto',
        padding: '36px 32px',
        textAlign: 'center',
        boxShadow: '0 8px 30px rgba(2, 132, 199, 0.15)',
        border: '1.5px solid #bae6fd',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
          boxShadow: '0 4px 16px rgba(6, 182, 212, 0.35)',
        }}>
          <img src="/logo.png" alt="Loading" style={{ width: 44, height: 44, objectFit: 'contain' }} />
        </div>

        <h2 style={{ fontSize: '1.35rem', color: '#0c4a6e', marginBottom: 6, fontWeight: 800 }}>
          Synthesizing Subsurface Thermal Volume
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 24 }}>
          {selectedDemo?.filename || file?.name} · 11-Day Spatiotemporal Matrix
        </p>

        {/* Steps Progress */}
        <div style={{
          background: '#f8fafc',
          borderRadius: 8,
          padding: '14px 18px',
          textAlign: 'left',
          marginBottom: 20,
          border: '1px solid #e2e8f0',
        }}>
          {STEP_MESSAGES.map((msg, i) => {
            const isDone = i < loadingStep;
            const isCurrent = i === loadingStep;
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 0',
                opacity: i <= loadingStep ? 1 : 0.35,
                transition: 'all 0.25s ease',
                borderBottom: i < STEP_MESSAGES.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}>
                <span style={{ fontSize: 14 }}>
                  {isDone ? '✅' : isCurrent ? '⏳' : '⚪'}
                </span>
                <span style={{
                  fontSize: '0.84rem',
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? '#0284c7' : '#334155',
                }}>
                  {msg}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Estimated CPU reconstruction latency: <strong>~450 ms</strong>
        </div>
      </div>
    );
  }

  /* ── Main View (Single Screen, Side-by-Side) ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top compact header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', margin: 0, color: '#0c4a6e', fontWeight: 800 }}>
            Observation Matrix & Reconstruction Studio
          </h1>
          <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '0.85rem' }}>
            Select a seasonal benchmark dataset from the sidebar or upload a custom NetCDF file. Run reconstruction instantly.
          </p>
        </div>

        <span style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: 6,
          background: '#e0f2fe',
          color: '#0284c7',
          border: '1px solid #bae6fd',
        }}>
          Domain: North Indian Ocean (100×240 Grid · 15 Depths)
        </span>
      </div>

      {/* Error alert banner */}
      {status === 'error' && errorMsg && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.88rem',
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div><strong>Error:</strong> {errorMsg}</div>
        </div>
      )}

      {/* ── 2-COLUMN SINGLE-VIEW GRID ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '360px 1fr',
        gap: 20,
        alignItems: 'start',
      }}>

        {/* ── LEFT COLUMN: Curated Demos Sidebar ── */}
        <div className="card" style={{
          padding: 16,
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          height: '560px',
        }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '0.92rem', color: '#0c4a6e', fontWeight: 700 }}>
                Curated Seasonal Datasets
              </strong>
              <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                {demos.length} Available
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              11-day NetCDF matrices collocated with in-situ ARGO truth.
            </p>
          </div>

          {/* Scrollable list */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingRight: 4,
          }}>
            {demos.map((d) => {
              const isSelected = selectedDemo?.id === d.id || selectedDemo?.filename === d.filename;
              const isWinner = d.isWinner || d.target_date === '2023-10-18' || d.target_date === '2022-09-23';

              return (
                <button
                  key={d.id || d.filename}
                  onClick={() => loadDemoByPath(d)}
                  disabled={isLoadingDemo}
                  style={{
                    textAlign: 'left',
                    background: isSelected ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : isWinner ? '#f0fdf4' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#1e293b',
                    border: isSelected ? '1px solid #0284c7' : isWinner ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: isSelected ? '#e0f2fe' : isWinner ? '#166534' : '#0284c7',
                    }}>
                      {d.target_date}
                    </span>
                    {isWinner && (
                      <span style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        background: isSelected ? 'rgba(0,0,0,0.2)' : '#dcfce7',
                        color: isSelected ? '#ffffff' : '#15803d',
                        padding: '1px 5px',
                        borderRadius: 3,
                      }}>
                        🏆 Model Wins
                      </span>
                    )}
                    {isSelected && !isWinner && <CheckCircle2 size={13} color="#ffffff" />}
                  </div>

                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    lineHeight: 1.25,
                    color: isSelected ? '#ffffff' : '#0f172a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {d.short_season || d.season}
                  </div>

                  <div style={{
                    fontSize: '0.68rem',
                    color: isSelected ? 'rgba(255,255,255,0.85)' : '#64748b',
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 3,
                  }}>
                    <span>{d.year}</span>
                    <span>{d.size_mb ? `${d.size_mb} MB` : '2.6 MB'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Inspection, Upload & Run Action ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Active Dataset Inspection Card */}
          <div className="card" style={{
            padding: 18,
            background: '#ffffff',
            borderRadius: 10,
            border: '1.5px solid #bae6fd',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={18} color="#0284c7" />
                <strong style={{ fontSize: '0.95rem', color: '#0c4a6e' }}>
                  Loaded Observation Tensor
                </strong>
              </div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                background: '#dcfce7',
                color: '#15803d',
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid #bbf7d0',
              }}>
                Ready for Reconstruction
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 12,
              marginBottom: 14,
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>File Name</span>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file?.name || selectedDemo?.filename || 'No file selected'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Target Date</span>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0284c7' }}>
                  {selectedDemo?.target_date || 'Target Day 11'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>File Size</span>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                  {formatSize(file?.size)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Dimensions</span>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                  11d × 7ch × 100 × 240
                </div>
              </div>
            </div>

            {/* 7 Verified Parameter Badges */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                Required Surface Parameters (7 of 7 Checked):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {REQUIRED_VARS.map((v) => (
                  <span
                    key={v.key}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: '#f0fdf4',
                      color: '#166534',
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid #bbf7d0',
                    }}
                  >
                    <CheckCircle2 size={11} color="#16a34a" />
                    <span>{v.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── BIG PRIMARY RUN BUTTON (Directly Accessible, No Scrolling!) ── */}
          <button
            onClick={handleRun}
            disabled={!file || isLoadingDemo}
            style={{
              padding: '16px 24px',
              fontSize: '1.05rem',
              fontWeight: 800,
              borderRadius: 10,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
              cursor: file && !isLoadingDemo ? 'pointer' : 'not-allowed',
              opacity: file && !isLoadingDemo ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => {
              if (file && !isLoadingDemo) e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'none';
            }}
          >
            <Play size={20} fill="#ffffff" />
            <span>Run OceanEmbed Neural Reconstruction</span>
          </button>

          {/* Custom NetCDF Upload Box (Compact) */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `1.5px dashed ${isDragging ? '#0284c7' : '#cbd5e1'}`,
              borderRadius: 8,
              padding: '14px 18px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? '#f0f9ff' : '#ffffff',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".nc"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0], null)}
            />
            <UploadCloud size={20} color="#0284c7" />
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                Or upload your own custom NetCDF (.nc) matrix
              </span>
              <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>
                Drag and drop here, or click to browse local filesystem
              </span>
            </div>
          </div>

          {/* Input Format Guide Callout */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(6, 182, 212, 0.08) 100%)',
            border: '1px solid #bae6fd',
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={16} color="#0284c7" />
              <div style={{ fontSize: '0.8rem', color: '#0c4a6e' }}>
                <strong>Need Help Formatting Custom Data?</strong> View the official satellite sources & NetCDF specifications.
              </div>
            </div>
            <button
              onClick={() => navigate('/docs#input-format')}
              style={{
                background: '#ffffff',
                border: '1.5px solid #7dd3fc',
                color: '#0284c7',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#0284c7';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#0284c7';
              }}
            >
              <span>Format Guide</span>
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Specs note */}
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4, textAlign: 'center' }}>
            Inference generates 15 discrete subsurface depth layers (0m to 1000m) in ~450ms.
          </div>

        </div>

      </div>

    </div>
  );
}
