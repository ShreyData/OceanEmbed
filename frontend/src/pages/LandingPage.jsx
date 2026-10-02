import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  BookOpen,
  Layers,
  Cpu,
  Compass,
  Activity,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Database,
  TrendingDown,
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 48, paddingBottom: 32 }}>

      {/* ── HERO BANNER ── */}
      <div style={{
        textAlign: 'center',
        padding: '56px 20px 40px',
        maxWidth: '920px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Neon Logo Icon with soft cyan glow */}
        <div style={{
          position: 'relative',
          marginBottom: 24,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute',
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, rgba(2, 132, 199, 0) 70%)',
            filter: 'blur(12px)',
            zIndex: 0,
          }} />
          <img
            src="/logo.png"
            alt="OceanEmbed Icon"
            style={{
              width: 84,
              height: 84,
              borderRadius: 20,
              objectFit: 'contain',
              position: 'relative',
              zIndex: 1,
              boxShadow: '0 8px 24px rgba(2, 132, 199, 0.35)',
              border: '2px solid rgba(56, 189, 248, 0.5)',
            }}
          />
        </div>

        {/* Domain Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid #bae6fd',
          borderRadius: 20,
          padding: '4px 14px',
          fontSize: '0.8rem',
          color: '#0284c7',
          fontWeight: 600,
          marginBottom: 16,
        }}>
          <Compass size={14} />
          <span>North Indian Ocean · 5.0°N–29.75°N, 45.0°E–104.75°E · 15 Depth Layers</span>
        </div>

        {/* Main Title */}
        <h1 style={{
          fontSize: '2.75rem',
          fontWeight: 800,
          lineHeight: 1.18,
          letterSpacing: '-0.03em',
          color: '#0c4a6e',
          marginBottom: 18,
        }}>
          Subsurface Ocean Temperature Reconstruction
          <span style={{ display: 'block', background: 'linear-gradient(90deg, #0284c7 0%, #06b6d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            from Surface Satellite Observations
          </span>
        </h1>

        {/* Natural Subtitle */}
        <p style={{
          fontSize: '1.1rem',
          color: '#475569',
          maxWidth: '740px',
          lineHeight: 1.65,
          marginBottom: 36,
        }}>
          Satellites observe only the skin layer of the ocean. OceanEmbed uses spatiotemporal deep learning to reconstruct the full 3D thermal water column from surface observations down to 1000 meters depth, validated against autonomous in-situ ARGO profiling floats.
        </p>

        {/* Two Distinct Navigation Buttons */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/input')}
            className="btn btn-primary"
            style={{
              padding: '13px 28px',
              fontSize: '0.95rem',
              borderRadius: 8,
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            }}
          >
            <Play size={18} fill="#ffffff" />
            <span>Launch Reconstruction Pipeline</span>
          </button>

          <button
            onClick={() => navigate('/docs')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '13px 26px',
              fontSize: '0.95rem',
              fontWeight: 600,
              borderRadius: 8,
              background: '#ffffff',
              color: '#334155',
              border: '1.5px solid #cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#0284c7';
              e.currentTarget.style.color = '#0284c7';
              e.currentTarget.style.background = '#f0f9ff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.color = '#334155';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <BookOpen size={18} color="#64748b" />
            <span>Technical Documentation</span>
          </button>
        </div>
      </div>

      {/* ── 4 KEY CAPABILITIES CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 18,
      }}>
        {/* Card 1 */}
        <div className="card" style={{ padding: 22, borderTop: '3px solid #0284c7' }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: '#e0f2fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            color: '#0284c7',
          }}>
            <Cpu size={22} />
          </div>
          <h3 style={{ fontSize: '1rem', color: '#0c4a6e', marginBottom: 6, fontWeight: 700 }}>
            Dual-Branch Spatiotemporal Model
          </h3>
          <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.55, margin: 0 }}>
            Combines multi-scale 3D temporal convolutions (2, 5, and 10 days) with a ConvLSTM recurrent memory core to track baroclinic eddy propagation and wind-driven mixing.
          </p>
        </div>

        {/* Card 2 */}
        <div className="card" style={{ padding: 22, borderTop: '3px solid #06b6d4' }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: '#ecfeff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            color: '#0891b2',
          }}>
            <Layers size={22} />
          </div>
          <h3 style={{ fontSize: '1rem', color: '#0c4a6e', marginBottom: 6, fontWeight: 700 }}>
            15 Vertical Depth Layers (0–1000m)
          </h3>
          <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.55, margin: 0 }}>
            Reconstructs thermal profiles from the sea surface mixed layer through the sharp thermocline down to the cold, dense abyssal water mass.
          </p>
        </div>

        {/* Card 3 */}
        <div className="card" style={{ padding: 22, borderTop: '3px solid #10b981' }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            color: '#059669',
          }}>
            <ShieldCheck size={22} />
          </div>
          <h3 style={{ fontSize: '1rem', color: '#0c4a6e', marginBottom: 6, fontWeight: 700 }}>
            In-Situ ARGO Float Validation
          </h3>
          <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.55, margin: 0 }}>
            Benchmarked against independent, physical autonomous CTD float profiles collected across 2022–2024, demonstrating consistent accuracy in surface and deep layers.
          </p>
        </div>

        {/* Card 4 */}
        <div className="card" style={{ padding: 22, borderTop: '3px solid #f59e0b' }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: '#fffbeb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            color: '#d97706',
          }}>
            <Activity size={22} />
          </div>
          <h3 style={{ fontSize: '1rem', color: '#0c4a6e', marginBottom: 6, fontWeight: 700 }}>
            Real-Time Inference Engine
          </h3>
          <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.55, margin: 0 }}>
            Compact 9.9 MB model checkpoint executing in ~450ms on standard CPUs, eliminating the need for expensive multi-GPU infrastructure during operational screening.
          </p>
        </div>
      </div>

      {/* ── 3-STEP OPERATIONAL PIPELINE OVERVIEW ── */}
      <div className="card" style={{ padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 28px' }}>
          <h2 style={{ fontSize: '1.4rem', color: '#0c4a6e', fontWeight: 800, marginBottom: 8 }}>
            How OceanEmbed Operates
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
            From raw multi-sensor NetCDF observations to volumetric 3D thermal fields in three steps.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {/* Step 1 */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#0284c7',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}>1</span>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>11-Day Surface Observations</strong>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              Ingest daily gridded arrays of Sea Surface Temperature, Salinity, Sea Level Anomaly, 10m Wind stress, and Surface Currents spanning 10 history days plus target-day forcing.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#0284c7',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}>2</span>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Neural Field Synthesis</strong>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              The model applies the static North Indian Ocean bathymetry mask, normalizes geophysical channels, and resolves vertical thermal propagation through the HASPP U-Net decoder.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#0284c7',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}>3</span>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Multi-Dimensional Analysis</strong>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              Explore horizontal isotherms across all 15 depths, rotate the 3D point cloud volume, inspect localized vertical CTD sounding curves, or download a structured physical report.
            </p>
          </div>
        </div>
      </div>

      {/* ── CALL TO ACTION BANNER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
        borderRadius: 14,
        padding: '36px 40px',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 20,
        boxShadow: '0 8px 24px rgba(2, 132, 199, 0.25)',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
            Ready to Explore the Subsurface Ocean?
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#bae6fd', maxWidth: 540 }}>
            Choose from 12 curated seasonal benchmark datasets or upload custom NetCDF observations to run real-time 3D reconstruction.
          </p>
        </div>

        <button
          onClick={() => navigate('/input')}
          style={{
            background: '#ffffff',
            color: '#0284c7',
            border: 'none',
            borderRadius: 8,
            padding: '12px 26px',
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'all 0.15s ease',
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; }}
        >
          <span>Open Prediction Studio</span>
          <ArrowRight size={16} />
        </button>
      </div>

    </div>
  );
}
