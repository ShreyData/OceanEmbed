import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Cpu,
  Layers,
  Database,
  Compass,
  ArrowRight,
  CheckCircle,
  FileCode,
  ShieldCheck,
  Activity,
  Maximize2,
  Minimize2,
  Maximize,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Download,
  Copy,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

const SECTIONS = [
  { id: 'overview', title: 'System Overview & Purpose', icon: Compass },
  { id: 'architecture', title: 'Neural Model Architecture & Flowcharts', icon: Cpu },
  { id: 'input-format', title: 'Input Format Guide & Satellite Sources', icon: FileCode },
  { id: 'features', title: 'Oceanographic Feature Guide', icon: Database },
  { id: 'layers', title: 'Vertical Stratification (15 Depths)', icon: Layers },
  { id: 'guide', title: 'Operational User Guide', icon: BookOpen },
  { id: 'validation', title: 'In-Situ Validation & Benchmark', icon: ShieldCheck },
];

export default function DocumentationPage() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('overview');
  const [copiedCode, setCopiedCode] = useState(false);
  const [modalImage, setModalImage] = useState(null); // { src, title }

  // Handle URL hash navigation (e.g. /docs#input-format or /docs#architecture)
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && SECTIONS.some((s) => s.id === hash)) {
      setActiveSection(hash);
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [location.hash]);

  const copyScript = () => {
    const scriptText = `import xarray as xr
import pandas as pd
import numpy as np

# 1. Define North Indian Ocean Standard Grid
lats = np.arange(5.0, 30.0, 0.25)    # 100 points (5.0°N to 29.75°N)
lons = np.arange(45.0, 105.0, 0.25)  # 240 points (45.0°E to 104.75°E)
times = pd.date_range('2023-10-08', periods=11, freq='D') # 11 consecutive days

# 2. Harmonize 7 Required Surface Observation Variables
# Replace with actual regridded arrays from OSTIA, SMAP, DUACS, OSCAR, CCMP:
data_vars = {
    'analysed_sst': (['time', 'latitude', 'longitude'], sst_array),  # °C
    'sos':          (['time', 'latitude', 'longitude'], sss_array),  # PSU
    'sla':          (['time', 'latitude', 'longitude'], sla_array),  # m
    'uwnd':         (['time', 'latitude', 'longitude'], uwnd_array), # m/s
    'vwnd':         (['time', 'latitude', 'longitude'], vwnd_array), # m/s
    'u':            (['time', 'latitude', 'longitude'], u_array),    # m/s
    'v':            (['time', 'latitude', 'longitude'], v_array),    # m/s
}

ds = xr.Dataset(
    data_vars=data_vars,
    coords={'time': times, 'latitude': lats, 'longitude': lons},
    attrs={'title': 'OceanEmbed 11-Day Input Observation Matrix'}
)

# 3. Save CF-compliant NetCDF-4 file
encoding = {var: {'zlib': True, 'complevel': 5} for var in ds.data_vars}
ds.to_netcdf('custom_ocean_11day.nc', encoding=encoding)`;

    navigator.clipboard.writeText(scriptText);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, rgba(6, 182, 212, 0.08) 100%)',
        border: '1px solid #bae6fd',
        borderRadius: '12px',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img
            src="/logo.png"
            alt="OceanEmbed Logo"
            style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'contain', border: '1px solid #7dd3fc' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: '1.65rem', color: '#0c4a6e', fontWeight: 800 }}>
                Technical Documentation & Reference Manual
              </h1>
              <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                SIH 2026 / INCOIS PS#01
              </span>
            </div>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>
              Comprehensive engineering reference, data schemas, satellite product recommendations, and neural architectures.
            </p>
          </div>
        </div>

        <Link
          to="/input"
          className="btn btn-primary"
          style={{ textDecoration: 'none', padding: '10px 20px', fontSize: '0.85rem' }}
        >
          Launch Inference Pipeline <ArrowRight size={16} />
        </Link>
      </div>

      {/* ── Two-Column Layout: Sidebar Navigation + Content ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Navigation Sidebar */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          position: 'sticky',
          top: 80,
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '8px 12px', letterSpacing: '0.05em' }}>
            Documentation Index
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    setActiveSection(sec.id);
                    document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 700 : 500,
                    background: isActive ? '#e0f2fe' : 'transparent',
                    color: isActive ? '#0284c7' : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <Icon size={16} color={isActive ? '#0284c7' : '#64748b'} />
                  <span>{sec.title}</span>
                </button>
              );
            })}
          </div>

          {/* Quick link to download Flowchart Diagrams */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', padding: '10px 12px' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Architecture Flowchart (PNG)
            </span>
            <a
              href="/architecture_flowchart.png"
              download="OceanEmbed_Neural_Architecture_Flowchart.png"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.75rem',
                color: '#0284c7',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Download size={13} />
              <span>Download Flowchart</span>
            </a>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Section 1: Overview ── */}
          <section id="overview" className="card" style={{ padding: 26 }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0c4a6e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Compass size={20} color="#0284c7" /> 1. System Overview & Problem Statement
            </h2>
            <div style={{ background: '#f8fafc', borderLeft: '3px solid #0284c7', padding: '10px 14px', borderRadius: '0 6px 6px 0', marginBottom: 14 }}>
              <strong style={{ color: '#0c4a6e', fontSize: '0.88rem' }}>Smart India Hackathon 2026 · Problem Statement #01 (INCOIS / MoES)</strong>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
                Title: <em>OceanEmbed - Satellite Embedding-Based Deep Learning Framework for Reconstruction of Subsurface Ocean Temperature from Surface Satellite Observations</em>
              </div>
            </div>

            <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: 14 }}>
              Subsurface ocean temperature is a fundamental variable for marine heatwave monitoring, cyclone intensification prediction, fisheries management, and data assimilation. However, electromagnetic radiation cannot penetrate seawater deeper than a few millimeters, restricting satellite observations to the skin surface. Traditional in-situ observation systems (such as ARGO profiling floats, moorings, and gliders) provide vertical thermal soundings but are spatially sparse and temporally intermittent.
            </p>
            <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: 16 }}>
              <strong>OceanEmbed</strong> resolves this limitation using deep representation learning. By transforming 11-day multi-sensor surface satellite observations into compact spatiotemporal embeddings, the framework reconstructs the continuous <strong>3D temperature field across 15 standard oceanographic depth levels (0m to 1000m) at 0.25° resolution</strong> for the entire North Indian Ocean basin.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 12,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 14,
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Spatial Domain</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>North Indian Ocean</div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>5.0°N–29.75°N · 45.0°E–104.75°E</div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Grid Resolution</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>0.25° × 0.25° (~27 km)</div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>100 Lat × 240 Lon Grid Cells</div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Vertical Resolution</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>15 Depth Levels</div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>0m to 1000m (CF standard)</div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Inference Latency</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0284c7', marginTop: 2 }}>~450 ms per Basin</div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Standard CPU execution</div>
              </div>
            </div>
          </section>

          {/* ── Section 2: Neural Architecture & Flowcharts ── */}
          <section id="architecture" className="card" style={{ padding: 26 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ fontSize: '1.25rem', color: '#0c4a6e', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Cpu size={20} color="#0284c7" /> 2. Neural Model Architecture & Interactive Flowchart
              </h2>
              <a
                href="/architecture_flowchart.png"
                download="OceanEmbed_Neural_Architecture_Flowchart.png"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 6,
                  background: '#f0f9ff',
                  color: '#0284c7',
                  border: '1px solid #bae6fd',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <Download size={14} /> Download Architecture Flowchart (PNG)
              </a>
            </div>

          <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: 16 }}>
            The architecture integrates a <strong>Temporal Scale Mixer (TS-Mixer)</strong>, a <strong>Spatiotemporal ConvLSTM</strong>, and a <strong>Hybrid Atrous Spatial Pyramid Pooling (HASPP)</strong> bottleneck into a dual-branch U-Net decoder with skip connections:
          </p>

          {/* Architecture Flowchart Image with Zoom / Modal */}
          <div style={{
            background: '#f8fafc',
            border: '1.5px solid #bae6fd',
            borderRadius: 10,
            padding: 16,
            marginBottom: 18,
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0c4a6e' }}>
                Model Computational Graph & Tensor Dimensions (1781 × 12,192 px)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href="/architecture_flowchart.png"
                  download="OceanEmbed_Neural_Architecture_Flowchart.png"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: '0.75rem',
                    color: '#0369a1',
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: 5,
                    padding: '4px 10px',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  <Download size={13} /> Download PNG
                </a>
                <button
                  onClick={() => setModalImage({
                    src: '/architecture_flowchart.png',
                    title: 'OceanEmbed v2 Neural Architecture Flowchart',
                    downloadName: 'OceanEmbed_Neural_Architecture_Flowchart.png',
                    dimensions: '1781 × 12,192 px',
                  })}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: '0.75rem',
                    color: '#ffffff',
                    background: '#0284c7',
                    border: 'none',
                    borderRadius: 5,
                    padding: '4px 12px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  <Maximize2 size={13} /> Fullscreen Zoom Viewer
                </button>
              </div>
            </div>

            <img
              src="/architecture_flowchart.png"
              alt="OceanEmbed Architecture Flowchart"
              onClick={() => setModalImage({
                src: '/architecture_flowchart.png',
                title: 'OceanEmbed v2 Neural Architecture Flowchart',
                downloadName: 'OceanEmbed_Neural_Architecture_Flowchart.png',
                dimensions: '1781 × 12,192 px',
              })}
              style={{
                width: '100%',
                maxHeight: 380,
                objectFit: 'contain',
                borderRadius: 6,
                cursor: 'zoom-in',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            />
            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: 8 }}>
              Click to open interactive Fullscreen Zoom & Pan viewer with 25%–300% zoom controls
            </span>
            </div>

            {/* Key Architectural Components */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 18 }}>
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12 }}>
                <strong style={{ fontSize: '0.85rem', color: '#0284c7' }}>1. Temporal Scale Mixer (3D Conv)</strong>
                <p style={{ fontSize: '0.78rem', color: '#475569', margin: '4px 0 0', lineHeight: 1.5 }}>
                  Branches with kernels <code>k=(2,1,1)</code>, <code>(5,1,1)</code>, <code>(10,1,1)</code> extract short-term turbulent mixing, synoptic waves, and mesoscale eddy advection.
                </p>
              </div>

              <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 8, padding: 12 }}>
                <strong style={{ fontSize: '0.85rem', color: '#0891b2' }}>2. Spatiotemporal ConvLSTM</strong>
                <p style={{ fontSize: '0.78rem', color: '#475569', margin: '4px 0 0', lineHeight: 1.5 }}>
                  Fuses multi-scale temporal representations into 32 hidden feature channels, preserving geographic spatial boundaries and vortex continuity across days.
                </p>
              </div>

              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12 }}>
                <strong style={{ fontSize: '0.85rem', color: '#059669' }}>3. HASPP Bottleneck (Dilation Rates)</strong>
                <p style={{ fontSize: '0.78rem', color: '#475569', margin: '4px 0 0', lineHeight: 1.5 }}>
                  Atrous pooling rates <code>r=[1, 6, 12, 18]</code> capture both local coastal boundary upwelling and basin-wide equatorial circulation without loss of resolution.
                </p>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12 }}>
                <strong style={{ fontSize: '0.85rem', color: '#d97706' }}>4. SFFM U-Net Skip Decoder</strong>
                <p style={{ fontSize: '0.78rem', color: '#475569', margin: '4px 0 0', lineHeight: 1.5 }}>
                  Combines the historical latent state with target-day surface observations via additive skip pathways, projecting directly into 15 vertical ocean depth fields.
                </p>
              </div>
            </div>

          </section>

          {/* ── Section 3: Input Format Guide & Satellite Sources (INCOIS SIH 2026) ── */}
          <section id="input-format" className="card" style={{ padding: 26 }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0c4a6e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileCode size={20} color="#0284c7" /> 3. NetCDF Input Format Guide & Official Satellite Data Sources
            </h2>
            <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: 14 }}>
              As specified in the <strong>INCOIS Smart India Hackathon 2026 Guidelines (PS#01)</strong>, inputs must be harmonized and standardized to a uniform <strong>0.25° grid</strong> across the North Indian Ocean basin. The table below lists the recommended satellite data products, access DOIs, and input dimensions:
            </p>

            {/* Official Satellite Sources Table directly from SIH26066.pdf */}
            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>Variable</th>
                    <th style={{ padding: '8px 10px' }}>NetCDF Key</th>
                    <th style={{ padding: '8px 10px' }}>Recommended Satellite Product</th>
                    <th style={{ padding: '8px 10px' }}>Native Res</th>
                    <th style={{ padding: '8px 10px' }}>Official Data Source / Provider</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0c4a6e' }}>Sea Surface Temp</td>
                    <td style={{ padding: '8px 10px' }}><code>analysed_sst</code></td>
                    <td style={{ padding: '8px 10px' }}>OSTIA SST (Copernicus)</td>
                    <td style={{ padding: '8px 10px' }}>0.05°, Daily</td>
                    <td style={{ padding: '8px 10px' }}>
                      <a href="https://doi.org/10.48670/moi-00168" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        doi:10.48670/moi-00168 <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0c4a6e' }}>Sea Surface Salinity</td>
                    <td style={{ padding: '8px 10px' }}><code>sos</code></td>
                    <td style={{ padding: '8px 10px' }}>SMAP / SMOS (Copernicus)</td>
                    <td style={{ padding: '8px 10px' }}>0.125°, Daily</td>
                    <td style={{ padding: '8px 10px' }}>
                      <a href="https://doi.org/10.48670/moi-00051" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        doi:10.48670/moi-00051 <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0c4a6e' }}>Sea Level Anomaly</td>
                    <td style={{ padding: '8px 10px' }}><code>sla</code></td>
                    <td style={{ padding: '8px 10px' }}>DUACS Radar Altimetry (CMEMS)</td>
                    <td style={{ padding: '8px 10px' }}>0.25°, Daily</td>
                    <td style={{ padding: '8px 10px' }}>
                      <a href="https://doi.org/10.48670/moi-00145" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        doi:10.48670/moi-00145 <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0c4a6e' }}>Surface Currents</td>
                    <td style={{ padding: '8px 10px' }}><code>u</code>, <code>v</code></td>
                    <td style={{ padding: '8px 10px' }}>OSCAR L4 Ocean Currents V2.0</td>
                    <td style={{ padding: '8px 10px' }}>0.25°, Daily</td>
                    <td style={{ padding: '8px 10px' }}>
                      <a href="https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_FINAL_V2.0" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        NASA JPL PO.DAAC <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0c4a6e' }}>10m Surface Winds</td>
                    <td style={{ padding: '8px 10px' }}><code>uwnd</code>, <code>vwnd</code></td>
                    <td style={{ padding: '8px 10px' }}>ASCAT-C Coastal & CCMP V3.1</td>
                    <td style={{ padding: '8px 10px' }}>0.25°, Daily</td>
                    <td style={{ padding: '8px 10px' }}>
                      <a href="https://podaac.jpl.nasa.gov/dataset/CCMP_WINDS_10M6HR_L4_V3.1" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        NASA PO.DAAC CCMP <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#166534' }}>Training Target 3D</td>
                    <td style={{ padding: '8px 10px' }}><code>thetao</code></td>
                    <td style={{ padding: '8px 10px' }}>GLORYS12V1 Global Reanalysis</td>
                    <td style={{ padding: '8px 10px' }}>0.25°, 15 Depths</td>
                    <td style={{ padding: '8px 10px' }}>
                      <a href="https://doi.org/10.48670/moi-00021" target="_blank" rel="noreferrer" style={{ color: '#166534', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        doi:10.48670/moi-00021 <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                  <tr style={{ background: '#fffbeb' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#92400e' }}>In-Situ Validation</td>
                    <td style={{ padding: '8px 10px' }}><code>argo_obs</code></td>
                    <td style={{ padding: '8px 10px' }}>INCOIS Live Access Server (LAS)</td>
                    <td style={{ padding: '8px 10px' }}>Discrete Profiles</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ color: '#92400e', fontWeight: 600 }}>INCOIS LAS Float Database</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Python / xarray Assembly Script Snippet */}
            <div style={{ background: '#0f172a', borderRadius: 8, padding: 16, color: '#f8fafc', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #334155', paddingBottom: 8 }}>
                <span style={{ fontWeight: 600, color: '#38bdf8' }}>
                  assemble_oceanembed_input.py (Reference Python Script)
                </span>
                <button
                  onClick={copyScript}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: 4,
                    color: '#e2e8f0',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {copiedCode ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                  <span>{copiedCode ? 'Copied' : 'Copy Snippet'}</span>
                </button>
              </div>

              <pre style={{ margin: 0, overflowX: 'auto', fontFamily: 'Consolas, monospace', lineHeight: 1.45, color: '#e2e8f0' }}>
{`import xarray as xr
import pandas as pd
import numpy as np

# 1. Standard North Indian Ocean Grid Coordinates
lats = np.arange(5.0, 30.0, 0.25)    # 100 points (5.0°N to 29.75°N)
lons = np.arange(45.0, 105.0, 0.25)  # 240 points (45.0°E to 104.75°E)
times = pd.date_range('2023-10-08', periods=11, freq='D') # 11 consecutive daily time steps

# 2. Assemble 7 Physical Variables (regridded to 100x240)
data_vars = {
    'analysed_sst': (['time', 'latitude', 'longitude'], sst_array),  # Sea Surface Temp (°C)
    'sos':          (['time', 'latitude', 'longitude'], sss_array),  # Sea Surface Salinity (PSU)
    'sla':          (['time', 'latitude', 'longitude'], sla_array),  # Sea Level Anomaly (m)
    'uwnd':         (['time', 'latitude', 'longitude'], uwnd_array), # Zonal 10m Wind (m/s)
    'vwnd':         (['time', 'latitude', 'longitude'], vwnd_array), # Meridional 10m Wind (m/s)
    'u':            (['time', 'latitude', 'longitude'], u_array),    # Zonal Current (m/s)
    'v':            (['time', 'latitude', 'longitude'], v_array),    # Meridional Current (m/s)
}

ds = xr.Dataset(data_vars=data_vars, coords={'time': times, 'latitude': lats, 'longitude': lons})
ds.to_netcdf('custom_ocean_11day.nc', encoding={v: {'zlib': True, 'complevel': 5} for v in ds.data_vars})`}
              </pre>
            </div>
          </section>

          {/* ── Section 4: Oceanographic Feature Guide ── */}
          <section id="features" className="card" style={{ padding: 26 }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0c4a6e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={20} color="#0284c7" /> 4. Oceanographic Feature & Parameter Guide
            </h2>
            <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: 16 }}>
              Physical rationale for each surface variable in subsurface thermal reconstruction:
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Variable</th>
                  <th style={{ padding: '8px 10px' }}>Parameter Name</th>
                  <th style={{ padding: '8px 10px' }}>Units</th>
                  <th style={{ padding: '8px 10px' }}>Physical Oceanographic Significance</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0284c7' }}><code>analysed_sst</code></td>
                  <td style={{ padding: '8px 10px' }}>Sea Surface Temp</td>
                  <td style={{ padding: '8px 10px' }}>°C</td>
                  <td style={{ padding: '8px 10px', color: '#475569' }}>Upper thermal boundary condition; determines mixed layer base and air-sea heat fluxes.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0284c7' }}><code>sos</code></td>
                  <td style={{ padding: '8px 10px' }}>Sea Surface Salinity</td>
                  <td style={{ padding: '8px 10px' }}>PSU</td>
                  <td style={{ padding: '8px 10px', color: '#475569' }}>Drives halosteric density gradients; critical for Bay of Bengal freshwater barrier layer dynamics.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0284c7' }}><code>sla</code></td>
                  <td style={{ padding: '8px 10px' }}>Sea Level Anomaly</td>
                  <td style={{ padding: '8px 10px' }}>m</td>
                  <td style={{ padding: '8px 10px', color: '#475569' }}>Altimetric proxy for vertically integrated ocean heat content and baroclinic pycnocline displacement.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0284c7' }}><code>uwnd</code>, <code>vwnd</code></td>
                  <td style={{ padding: '8px 10px' }}>Zonal / Meridional Winds</td>
                  <td style={{ padding: '8px 10px' }}>m/s</td>
                  <td style={{ padding: '8px 10px', color: '#475569' }}>Wind-stress curl governs Ekman pumping, thermocline shoaling, and intense monsoon upwelling along Somalia/Oman.</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0284c7' }}><code>u</code>, <code>v</code></td>
                  <td style={{ padding: '8px 10px' }}>Surface Ocean Currents</td>
                  <td style={{ padding: '8px 10px' }}>m/s</td>
                  <td style={{ padding: '8px 10px', color: '#475569' }}>Horizontal advection transporting heat and salt across the equatorial channel into the northern sub-basins.</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── Section 5: Vertical Stratification ── */}
          <section id="layers" className="card" style={{ padding: 26 }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0c4a6e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={20} color="#0284c7" /> 5. Standard Vertical Depth Levels (0m to 1000m)
            </h2>
            <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: 14 }}>
              The output volume reconstructs the 15 standard oceanographic depths designated in the SIH problem statement:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                  Epipelagic / Mixed Layer
                </span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0c4a6e', margin: '4px 0' }}>
                  0m · 5m · 10m · 20m · 30m · 50m
                </div>
                <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0 }}>
                  Subject to diurnal solar heating and wind mixing. Quasi-isothermal upper boundary.
                </p>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Mesopelagic / Thermocline Core
                </span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#064e3b', margin: '4px 0' }}>
                  75m · 100m · 125m · 150m · 200m
                </div>
                <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0 }}>
                  Zone of maximum vertical temperature gradient (dT/dz up to -0.15°C/m). Driven by pycnocline heave.
                </p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Deep Ocean Water Mass
                </span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', margin: '4px 0' }}>
                  300m · 500m · 700m · 1000m
                </div>
                <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0 }}>
                  Stable, cold intermediate and abyssal waters (down to 6°C at 1000m). Minimal seasonal variation.
                </p>
              </div>
            </div>
          </section>

          {/* ── Section 6: Operational Guide ── */}
          <section id="guide" className="card" style={{ padding: 26 }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0c4a6e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <BookOpen size={20} color="#0284c7" /> 6. Operational User Guide
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.88rem', color: '#334155' }}>
              <div><strong>1. Dataset Selection:</strong> Choose from 12 pre-indexed multi-seasonal demo datasets covering all monsoon phases (2022–2024), or upload your own 11-day NetCDF file.</div>
              <div><strong>2. Execution:</strong> Click <em>Run OceanEmbed Neural Reconstruction</em>. The backend validates coordinates, checks variables, normalizes features, and infers 15 depth layers in ~450ms.</div>
              <div><strong>3. Visual Analytics:</strong> View horizontal thermal isotherms in the 2D tab, rotate the interactive 3D point cloud volume in the 3D tab, or click any coordinate to view the vertical CTD sounding profile.</div>
              <div><strong>4. Report Download:</strong> Click <em>Download Oceanographic Report</em> on the dashboard header to generate a print-ready physical report containing layer statistics, thermocline gradients, and sub-basin averages.</div>
            </div>
          </section>

          {/* ── Section 7: Validation ── */}
          <section id="validation" className="card" style={{ padding: 26 }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0c4a6e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={20} color="#0284c7" /> 7. In-Situ Validation & Skill Metrics
            </h2>
            <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: 10 }}>
              Independent validation is conducted against <strong>INCOIS ARGO profiling floats</strong> and <strong>Copernicus GLORYS12V1 reanalysis</strong>:
            </p>
            <ul style={{ paddingLeft: 20, color: '#475569', fontSize: '0.85rem', lineHeight: 1.6 }}>
              <li><strong>Discrete Float Collocation:</strong> ARGO observations are evaluated at their exact physical sounding positions without applying spatial interpolation across unobserved ocean areas.</li>
              <li><strong>Evaluation Metrics:</strong> Root Mean Square Error (RMSE), Mean Absolute Error (MAE), Bias (°C), and Pearson correlation ($R^2$).</li>
              <li><strong>Zero Multi-Year Drift:</strong> Holdout testing across 2022–2024 confirms stable, zero-drift generalization across unseen monsoon cycles.</li>
            </ul>
          </section>

        </div>
      </div>

      {/* ── High-Resolution Interactive Flowchart Viewer Modal ── */}
      {modalImage && (
        <FlowchartViewerModal
          modalImage={modalImage}
          onClose={() => setModalImage(null)}
        />
      )}
    </div>
  );
}

function FlowchartViewerModal({ modalImage, onClose }) {
  const [zoom, setZoom] = useState(65); // comfortable initial viewing zoom
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const viewportRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 25, 300));
      } else if (e.key === '-' || e.key === '_') {
        setZoom((z) => Math.max(z - 25, 20));
      } else if (e.key === '0') {
        setZoom(100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 300));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 20));
  const handleReset100 = () => setZoom(100);
  const handleFitWidth = () => {
    if (viewportRef.current) {
      const availableW = viewportRef.current.clientWidth - 48;
      const fit = Math.round((availableW / 1781) * 100);
      setZoom(Math.max(20, Math.min(fit, 300)));
    }
  };

  // Drag to pan
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    if (viewportRef.current) {
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        scrollLeft: viewportRef.current.scrollLeft,
        scrollTop: viewportRef.current.scrollTop,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !viewportRef.current) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    viewportRef.current.scrollLeft = dragStart.scrollLeft - dx;
    viewportRef.current.scrollTop = dragStart.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom when holding Ctrl / Cmd
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(z + 15, 300));
      } else {
        setZoom((z) => Math.max(z - 15, 20));
      }
    }
  };

  const computedWidth = Math.round((1781 * zoom) / 100);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.95)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 18px',
          background: '#090e17',
          borderBottom: '1px solid #1e293b',
          color: '#f8fafc',
          flexWrap: 'wrap',
          gap: 12,
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.96rem', fontWeight: 700, color: '#38bdf8' }}>
              {modalImage.title}
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontWeight: 600,
              }}
            >
              {modalImage.dimensions || '1781 × 12,192 px'}
            </span>
          </div>
          <span style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
            Click & drag to pan • Ctrl + Wheel to zoom • Shortcuts: [ + ] [ - ] [ 0 ] [ Esc ]
          </span>
        </div>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 20}
            title="Zoom Out (-)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '0.78rem',
              cursor: zoom <= 20 ? 'not-allowed' : 'pointer',
              opacity: zoom <= 20 ? 0.5 : 1,
            }}
          >
            <ZoomOut size={14} />
          </button>

          {/* Zoom Badge */}
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#38bdf8',
              background: '#0f172a',
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid #1e293b',
              minWidth: 50,
              textAlign: 'center',
            }}
          >
            {zoom}%
          </span>

          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 300}
            title="Zoom In (+)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '0.78rem',
              cursor: zoom >= 300 ? 'not-allowed' : 'pointer',
              opacity: zoom >= 300 ? 0.5 : 1,
            }}
          >
            <ZoomIn size={14} />
          </button>

          {/* Fit Width */}
          <button
            onClick={handleFitWidth}
            title="Fit image width to current screen"
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Fit Width
          </button>

          {/* 100% Reset */}
          <button
            onClick={handleReset100}
            title="Reset to 100% Original Resolution"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <RotateCcw size={13} /> 100%
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize size={14} />}
            <span>{isFullscreen ? 'Exit' : 'Full'}</span>
          </button>

          {/* Download Flowchart Button */}
          <a
            href={modalImage.src}
            download={modalImage.downloadName || 'OceanEmbed_Flowchart.png'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
            }}
          >
            <Download size={14} /> Download Flowchart (PNG)
          </a>

          {/* Close Modal */}
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              background: '#dc2626',
              border: 'none',
              borderRadius: 6,
              color: '#ffffff',
              cursor: 'pointer',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '24px 16px',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          backgroundColor: '#020617',
        }}
      >
        <img
          src={modalImage.src}
          alt={modalImage.title}
          draggable={false}
          style={{
            width: `${computedWidth}px`,
            maxWidth: 'none',
            height: 'auto',
            borderRadius: 8,
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            backgroundColor: '#ffffff',
            transition: isDragging ? 'none' : 'width 0.15s ease',
          }}
        />
      </div>
    </div>
  );
}
