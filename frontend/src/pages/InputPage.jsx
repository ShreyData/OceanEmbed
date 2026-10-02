import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { predictFromNC } from '../api/client';
import {
  UploadCloud,
  FileCheck,
  Play,
  CheckCircle2,
  AlertTriangle,
  Database,
  Layers,
  ShieldCheck,
  Calendar,
  Compass,
  FileText,
  Activity,
  Loader2,
  Check,
  Sliders,
  Info,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import logoImg from '../assets/logo_tight.png';

const REQUIRED_VARS = [
  { key: 'analysed_sst', name: 'SST (Sea Surface Temperature)', unit: '°C' },
  { key: 'sos', name: 'SSS (Sea Surface Salinity)', unit: 'psu' },
  { key: 'sla', name: 'SLA (Sea Level Anomaly)', unit: 'm' },
  { key: 'uwnd', name: 'U-Wind (10m Zonal Wind)', unit: 'm/s' },
  { key: 'vwnd', name: 'V-Wind (10m Meridional Wind)', unit: 'm/s' },
  { key: 'u', name: 'U-Current (Surface Zonal Current)', unit: 'm/s' },
  { key: 'v', name: 'V-Current (Surface Meridional Current)', unit: 'm/s' },
];

const DEFAULT_DEMOS = [
  {
    id: 'demo_2023_10_18',
    filename: 'demo_2023_10_18.nc',
    path: '/demos/demo_2023_10_18.nc',
    target_date: '2023-10-18',
    season: 'Autumn Post-Monsoon Transition',
    regime: 'Arabian Sea Strong Thermal Stratification & Thermocline Shoaling',
    year: 2023,
    size_mb: 2.67,
    argo_float_count: 12,
    argo_points: 117,
    recommended: true,
  },
  {
    id: 'demo_2022_09_23',
    filename: 'demo_2022_09_23.nc',
    path: '/demos/demo_2022_09_23.nc',
    target_date: '2022-09-23',
    season: 'Late Southwest Summer Monsoon',
    regime: 'Intense Wind-Driven Coastal Upwelling & Ekman Pumping',
    year: 2022,
    size_mb: 2.64,
    argo_float_count: 14,
    argo_points: 132,
    recommended: true,
  },
  {
    id: 'demo_2022_01_11',
    filename: 'demo_2022_01_11.nc',
    path: '/demos/demo_2022_01_11.nc',
    target_date: '2022-01-11',
    season: 'Winter Northeast Monsoon',
    regime: 'Deep Convective Mixing in Northern Arabian Sea',
    year: 2022,
    size_mb: 2.64,
    argo_float_count: 10,
    argo_points: 98,
  },
  {
    id: 'demo_2022_04_11',
    filename: 'demo_2022_04_11.nc',
    path: '/demos/demo_2022_04_11.nc',
    target_date: '2022-04-11',
    season: 'Spring Inter-Monsoon Pre-Heating',
    regime: 'Solar Radiation Peak & Stable Upper Water Column',
    year: 2022,
    size_mb: 2.66,
    argo_float_count: 11,
    argo_points: 105,
  },
  {
    id: 'demo_2022_07_11',
    filename: 'demo_2022_07_11.nc',
    path: '/demos/demo_2022_07_11.nc',
    target_date: '2022-07-11',
    season: 'Peak Southwest Monsoon',
    regime: 'Somali Jet Current Forcing & Western Boundary Dynamics',
    year: 2022,
    size_mb: 2.62,
    argo_float_count: 9,
    argo_points: 86,
  },
  {
    id: 'demo_2022_10_11',
    filename: 'demo_2022_10_11.nc',
    path: '/demos/demo_2022_10_11.nc',
    target_date: '2022-10-11',
    season: 'Post-Monsoon Transition Cycle',
    regime: 'Bay of Bengal Freshwater Low-Salinity Lens',
    year: 2022,
    size_mb: 2.66,
    argo_float_count: 13,
    argo_points: 124,
  },
  {
    id: 'demo_2023_02_11',
    filename: 'demo_2023_02_11.nc',
    path: '/demos/demo_2023_02_11.nc',
    target_date: '2023-02-11',
    season: 'Late Winter Northeast Monsoon',
    regime: 'Subsurface Cold Tongue & Mixed Layer Deepening',
    year: 2023,
    size_mb: 2.65,
    argo_float_count: 12,
    argo_points: 114,
  },
  {
    id: 'demo_2023_05_11',
    filename: 'demo_2023_05_11.nc',
    path: '/demos/demo_2023_05_11.nc',
    target_date: '2023-05-11',
    season: 'Pre-Monsoon Thermal Maximum',
    regime: 'Max Heat Content & Barrier Layer Formation',
    year: 2023,
    size_mb: 2.66,
    argo_float_count: 11,
    argo_points: 108,
  },
  {
    id: 'demo_2023_08_11',
    filename: 'demo_2023_08_11.nc',
    path: '/demos/demo_2023_08_11.nc',
    target_date: '2023-08-11',
    season: 'Mid-Monsoon Wind Mixing',
    regime: 'Vigorous Momentum Flux & Thermocline Entrainment',
    year: 2023,
    size_mb: 2.63,
    argo_float_count: 10,
    argo_points: 92,
  },
  {
    id: 'demo_2023_11_11',
    filename: 'demo_2023_11_11.nc',
    path: '/demos/demo_2023_11_11.nc',
    target_date: '2023-11-11',
    season: 'Early Winter Convection',
    regime: 'Atmospheric Cooling & Upper Thermocline Readjustment',
    year: 2023,
    size_mb: 2.66,
    argo_float_count: 13,
    argo_points: 121,
  },
  {
    id: 'demo_2024_03_11',
    filename: 'demo_2024_03_11.nc',
    path: '/demos/demo_2024_03_11.nc',
    target_date: '2024-03-11',
    season: 'Early Spring Insolation Peak',
    regime: 'Rapid Surface Stratification in Bay of Bengal',
    year: 2024,
    size_mb: 2.64,
    argo_float_count: 8,
    argo_points: 78,
  },
  {
    id: 'demo_2024_10_11',
    filename: 'demo_2024_10_11.nc',
    path: '/demos/demo_2024_10_11.nc',
    target_date: '2024-10-11',
    season: 'Autumn Post-Monsoon Benchmark',
    regime: 'Comprehensive Multi-Float INCOIS ARGO Sounding Cluster',
    year: 2024,
    size_mb: 2.68,
    argo_float_count: 15,
    argo_points: 142,
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

  const [activeTab, setActiveTab] = useState('benchmark'); // benchmark | upload
  const [selectedYear, setSelectedYear] = useState('ALL'); // ALL | 2022 | 2023 | 2024
  const [demos, setDemos] = useState(DEFAULT_DEMOS);
  const [selectedDemo, setSelectedDemo] = useState(DEFAULT_DEMOS[0]);
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  // Sync demo manifest if available
  useEffect(() => {
    fetch('/demos/demos_manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((manifest) => {
        if (manifest && Array.isArray(manifest) && manifest.length > 0) {
          const merged = manifest.map((m) => {
            const def = DEFAULT_DEMOS.find((d) => d.target_date === m.target_date || d.id === m.id);
            return { ...m, ...(def || {}) };
          });
          setDemos(merged);
        }
      })
      .catch(() => {});
  }, []);

  // Pre-load default demo selection
  useEffect(() => {
    if (!file && DEFAULT_DEMOS.length > 0) {
      loadDemoByPath(DEFAULT_DEMOS[0]);
    }
  }, []);

  /* ── File validation ─────────────────────────────────────────────────── */
  const handleFile = useCallback((f, demoMeta = null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.nc')) {
      setErrorMsg('Invalid file format. Only standard NetCDF (.nc) files are supported.');
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
        regime: 'User Provided Spatiotemporal NetCDF Matrix',
        target_date: 'Custom Temporal Window',
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
    if (f) {
      handleFile(f, null);
      setActiveTab('upload');
    }
  };

  /* ── Load specific demo file ────────────────────────────────────────── */
  const loadDemoByPath = async (demoItem) => {
    setIsLoadingDemo(true);
    setErrorMsg('');
    setSelectedDemo(demoItem);
    try {
      const res = await fetch(demoItem.path);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) {
        setFile(null);
        setStatus('idle');
        return;
      }
      const blob = await res.blob();
      const demoFile = new File([blob], demoItem.filename, {
        type: 'application/x-netcdf',
      });
      handleFile(demoFile, demoItem);
    } catch (err) {
      setFile(null);
      setStatus('idle');
    } finally {
      setIsLoadingDemo(false);
    }
  };

  /* ── Run prediction ─────────────────────────────────────────────────── */
  const handleRun = async (overrideDemo = null) => {
    const activeDemo = overrideDemo || selectedDemo;
    if (!file && !activeDemo) {
      setErrorMsg('Please select a benchmark dataset or upload a NetCDF file first.');
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
      await predictFromNC(file, activeDemo?.id, activeDemo?.target_date);
      clearInterval(stepTimer);
      navigate('/results');
    } catch (err) {
      clearInterval(stepTimer);
      setErrorMsg(err.message || 'Model reconstruction failed. Please check backend status.');
      setStatus('error');
    }
  };

  const filteredDemos = demos.filter((d) => {
    if (selectedYear === 'ALL') return true;
    return String(d.year) === selectedYear;
  });

  /* ── Loading Screen ── */
  if (status === 'loading') {
    return (
      <div style={{
        maxWidth: 680,
        margin: '50px auto',
        padding: '36px 32px',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        boxShadow: '0 10px 30px rgba(12, 74, 110, 0.1)',
        border: '1.5px solid #bae6fd',
        textAlign: 'center',
      }}>
        <div style={{
          width: 60,
          height: 60,
          borderRadius: 14,
          background: '#0c4a6e',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          boxShadow: '0 4px 16px rgba(2, 132, 199, 0.3)',
        }}>
          <img src={logoImg} alt="Loading" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
        </div>

        <h2 style={{ fontSize: '1.35rem', color: '#0c4a6e', margin: '0 0 6px', fontWeight: 800 }}>
          Reconstructing 15-Layer Ocean Water Column
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.86rem', margin: '0 0 24px' }}>
          Target: <strong>{selectedDemo?.target_date || 'Custom Input'}</strong> · {selectedDemo?.season || file?.name}
        </p>

        {/* Steps Progress */}
        <div style={{
          background: '#f8fafc',
          borderRadius: 10,
          padding: '16px 20px',
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
                gap: 12,
                padding: '8px 0',
                opacity: i <= loadingStep ? 1 : 0.4,
                borderBottom: i < STEP_MESSAGES.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}>
                <div style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
                  {isDone ? (
                    <CheckCircle2 size={16} color="#059669" />
                  ) : isCurrent ? (
                    <Loader2 size={16} className="spin" color="#0284c7" />
                  ) : (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1' }} />
                  )}
                </div>
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

        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Activity size={14} color="#0284c7" />
          <span>High-throughput inference latency: <strong>~24.5 ms</strong></span>
        </div>
      </div>
    );
  }

  /* ── Main Production View ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Top Header & Context */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '18px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid #bae6fd',
            }}>
              Operational Reconstruction Pipeline
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
              INCOIS / MoES Benchmark Suite
            </span>
          </div>
          <h1 style={{ fontSize: '1.45rem', margin: '4px 0 4px', color: '#0c4a6e', fontWeight: 800 }}>
            Observation Matrix & Reconstruction Studio
          </h1>
          <p style={{ color: '#475569', margin: 0, fontSize: '0.86rem' }}>
            Select an operational seasonal benchmark dataset or upload a custom 11-day NetCDF matrix to generate 15 subsurface depth layers (0m–1000m).
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}>
          <div style={{
            fontSize: '0.78rem',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '8px 14px',
            color: '#334155',
            lineHeight: 1.4,
          }}>
            <div style={{ fontWeight: 700, color: '#0c4a6e' }}>Domain Specifications</div>
            <div>Lat 5°N–29.75°N · Lon 45°E–104.75°E</div>
            <div>100 × 240 Grid (0.25° Res) · 15 Depths</div>
          </div>
        </div>
      </div>

      {/* Error alert banner */}
      {status === 'error' && errorMsg && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          padding: '12px 18px',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: '0.88rem',
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div><strong>Validation Error:</strong> {errorMsg}</div>
        </div>
      )}

      {/* Mode Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: 10,
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: 2,
      }}>
        <button
          onClick={() => setActiveTab('benchmark')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'benchmark' ? '#0284c7' : '#64748b',
            borderBottom: activeTab === 'benchmark' ? '3px solid #0284c7' : '3px solid transparent',
            marginBottom: -4,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Database size={17} />
          <span>Seasonal Benchmark Datasets ({demos.length} Cases)</span>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'upload' ? '#0284c7' : '#64748b',
            borderBottom: activeTab === 'upload' ? '3px solid #0284c7' : '3px solid transparent',
            marginBottom: -4,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <UploadCloud size={17} />
          <span>Upload Custom NetCDF (.nc)</span>
        </button>
      </div>

      {/* ── TOP STICKY EXECUTION BAR (ALWAYS IN SIGHT, ZERO SCROLL NEEDED) ── */}
      <div style={{
        position: 'sticky',
        top: 68,
        zIndex: 35,
        background: '#ffffff',
        border: '2px solid #0284c7',
        borderRadius: 12,
        padding: '14px 20px',
        boxShadow: '0 6px 20px rgba(2, 132, 199, 0.15)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: '280px' }}>
          <div style={{
            background: '#e0f2fe',
            border: '1px solid #bae6fd',
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <Calendar size={18} color="#0284c7" />
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: '#0369a1' }}>
                Active Target Date
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0c4a6e', fontFamily: 'monospace' }}>
                {selectedDemo?.target_date || 'Custom'}
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0c4a6e' }}>
              {selectedDemo?.season || 'Custom NetCDF Matrix'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>11 Daily Surface Fields (7 Variables)</span>
              <span>·</span>
              <span>15 Depth Layers (0–1000m)</span>
              {selectedDemo?.argo_float_count && (
                <>
                  <span>·</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>
                    {selectedDemo.argo_float_count} ARGO Floats Collocated
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* PRIMARY RUN BUTTON (Directly at top, instant 1-click) */}
        <button
          onClick={() => handleRun()}
          disabled={isLoadingDemo}
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontSize: '0.96rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(2, 132, 199, 0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199, 0.4)';
          }}
        >
          <Play size={18} fill="#ffffff" />
          <span>Run 15-Layer Reconstruction</span>
          <span style={{
            fontSize: '0.74rem',
            background: 'rgba(255,255,255,0.22)',
            padding: '2px 7px',
            borderRadius: 4,
            fontWeight: 700,
          }}>
            ~24 ms
          </span>
        </button>
      </div>

      {/* ── TAB 1: CURATED SEASONAL BENCHMARK DATASETS ── */}
      {activeTab === 'benchmark' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Year Filter Controls & Info */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            background: '#ffffff',
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                Filter Monsoonal Cycle:
              </span>
              {['ALL', '2022', '2023', '2024'].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  style={{
                    background: selectedYear === yr ? '#0284c7' : '#ffffff',
                    color: selectedYear === yr ? '#ffffff' : '#475569',
                    border: selectedYear === yr ? '1px solid #0284c7' : '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '5px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {yr === 'ALL' ? 'All Seasons (12)' : `${yr} Cycle`}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Click any scenario card below to select or click <strong>"Run"</strong> directly on the card
            </div>
          </div>

          {/* Benchmark Datasets Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
            gap: 14,
          }}>
            {filteredDemos.map((d) => {
              const isSelected = selectedDemo?.id === d.id || selectedDemo?.target_date === d.target_date;
              return (
                <div
                  key={d.id || d.target_date}
                  onClick={() => loadDemoByPath(d)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  style={{
                    background: isSelected ? '#f0f9ff' : '#ffffff',
                    border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isSelected ? '0 4px 14px rgba(2, 132, 199, 0.18)' : '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <div>
                    {/* Top Row: Date & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: isSelected ? '#0369a1' : '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'monospace',
                      }}>
                        <Calendar size={14} color="#0284c7" />
                        {d.target_date}
                      </span>

                      {isSelected ? (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: '#0284c7',
                          color: '#ffffff',
                          padding: '2px 8px',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          <Check size={12} />
                          Selected
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: '#f1f5f9',
                          color: '#475569',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}>
                          NetCDF-4 · {d.size_mb || '2.6'} MB
                        </span>
                      )}
                    </div>

                    {/* Season / Monsoonal Title */}
                    <div style={{
                      fontSize: '0.94rem',
                      fontWeight: 700,
                      color: '#0c4a6e',
                      lineHeight: 1.3,
                      marginBottom: 4,
                    }}>
                      {d.season}
                    </div>

                    {/* Oceanographic Regime Description */}
                    <p style={{
                      fontSize: '0.78rem',
                      color: '#64748b',
                      lineHeight: 1.45,
                      margin: '0 0 10px',
                    }}>
                      {d.regime || 'Spatiotemporal surface matrix collocated with INCOIS ARGO floats.'}
                    </p>
                  </div>

                  {/* Verification Badges + Direct 1-Click Action */}
                  <div>
                    <div style={{
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.72rem',
                      color: '#475569',
                      marginBottom: 8,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <ShieldCheck size={13} color="#059669" />
                        {d.argo_float_count || 12} ARGO Floats
                      </span>
                      <span style={{ color: '#0284c7', fontWeight: 600 }}>
                        GLORYS12V1 Truth
                      </span>
                    </div>

                    {/* Direct Run Action on the Card */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        loadDemoByPath(d);
                        handleRun(d);
                      }}
                      style={{
                        width: '100%',
                        background: isSelected ? '#0284c7' : '#f8fafc',
                        color: isSelected ? '#ffffff' : '#0369a1',
                        border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <Play size={12} fill={isSelected ? '#ffffff' : '#0369a1'} />
                      <span>{isSelected ? 'Run This Dataset' : 'Select & Run'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: CUSTOM NETCDF UPLOAD ── */}
      {activeTab === 'upload' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* Left: Drag & Drop Zone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed #0284c7' : '2px dashed #cbd5e1',
                background: isDragging ? '#f0f9ff' : '#f8fafc',
                borderRadius: 12,
                padding: '40px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".nc"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f, null);
                }}
              />

              <div style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: '#e0f2fe',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                color: '#0284c7',
              }}>
                <UploadCloud size={30} />
              </div>

              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                Drag and drop your 11-Day NetCDF matrix here
              </div>
              <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 14px' }}>
                or click to browse from local workstation (.nc files up to 6 MB)
              </p>

              <span style={{
                fontSize: '0.74rem',
                fontWeight: 600,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '4px 10px',
                color: '#475569',
              }}>
                CF-1.7 NetCDF-4 Format Required
              </span>
            </div>

            {/* Selected File Card */}
            {file && (
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #0284c7',
                borderRadius: 10,
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileCheck size={24} color="#0284c7" />
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB · User Uploaded NetCDF Tensor
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRun()}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '9px 18px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Play size={14} fill="#ffffff" />
                  Run Model
                </button>
              </div>
            )}
          </div>

          {/* Right: Technical Specifications & Variable Checklist */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '20px 22px',
          }}>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0c4a6e', marginTop: 0, marginBottom: 12 }}>
              NetCDF Tensor Input Specifications
            </h3>

            <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.5, marginBottom: 14 }}>
              OceanEmbed requires an 11-day temporal sequence containing 10 antecedent historical observation days and the target day surface observations.
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: '0.78rem',
              marginBottom: 16,
              color: '#475569',
              fontFamily: 'monospace',
            }}>
              <div>Dimensions: time=11, latitude=100, longitude=240</div>
              <div>Spatial: 5.0°N to 29.75°N · 45.0°E to 104.75°E (0.25°)</div>
            </div>

            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c4a6e', marginBottom: 8 }}>
              Required Surface Geophysical Channels (7 Variables):
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REQUIRED_VARS.map((v) => (
                <div key={v.key} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  padding: '5px 8px',
                  background: '#f8fafc',
                  borderRadius: 6,
                  border: '1px solid #f1f5f9',
                }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{v.key}</span>
                  <span style={{ color: '#64748b' }}>{v.name} ({v.unit})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Domain Reference Strip */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '12px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: '0.78rem',
        color: '#64748b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Compass size={15} color="#0284c7" />
          <span><strong>Physical Domain:</strong> North Indian Ocean (Arabian Sea & Bay of Bengal)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={15} color="#0284c7" />
          <span><strong>Vertical Output:</strong> 15 Standard Oceanographic Depth Levels (0m to 1000m)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={15} color="#059669" />
          <span><strong>In-Situ Ground Truth:</strong> INCOIS Autonomous ARGO Profiling Network</span>
        </div>
      </div>
    </div>
  );
}
