import React, { useState, useEffect } from 'react';
import {
  Monitor,
  AlertTriangle,
  Copy,
  Check,
  Layers,
  Activity,
  Compass,
  Database,
  ExternalLink,
} from 'lucide-react';

export default function MobileBlocker({ children }) {
  const [isMobile, setIsMobile] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent.toLowerCase()
      );
      // Trigger if viewport is narrower than 920px or detected as a phone
      setIsMobile(width < 920 || (isMobileDevice && width < 1024));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 16px',
      boxSizing: 'border-box',
    }}>
      {/* Institutional Top Bar */}
      <div style={{
        background: '#0c4a6e',
        color: '#e0f2fe',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '6px 12px',
        borderRadius: 6,
        textAlign: 'center',
        marginBottom: 16,
      }}>
        INCOIS · MoES · SIH 2026 Problem Statement
      </div>

      {/* Brand Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '1px solid #e2e8f0',
      }}>
        <img
          src="/logo.png"
          alt="OceanEmbed Logo"
          style={{
            height: 42,
            width: 'auto',
            borderRadius: 8,
            objectFit: 'contain',
            background: '#ffffff',
            padding: 2,
            border: '1px solid #cbd5e1',
          }}
        />
        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c4a6e', lineHeight: 1.1 }}>
            Ocean<span style={{ color: '#0284c7' }}>Embed</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
            Subsurface Thermal Profiling Engine
          </div>
        </div>
      </div>

      {/* Warning Notice Card */}
      <div style={{
        background: '#fffbeb',
        border: '1.5px solid #fcd34d',
        borderRadius: 12,
        padding: '18px 16px',
        marginBottom: 20,
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            background: '#fef3c7',
            color: '#b45309',
            padding: 6,
            borderRadius: 8,
            display: 'flex',
          }}>
            <Monitor size={22} />
          </div>
          <div>
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#b45309',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Workstation Environment Required
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#78350f' }}>
              This system is not accessible via mobile
            </div>
          </div>
        </div>

        <p style={{
          fontSize: '0.84rem',
          lineHeight: 1.55,
          color: '#92400e',
          margin: '0 0 14px',
        }}>
          The OceanEmbed platform executes high-resolution 3D bathymetric tensor rendering, 
          15-layer vertical thermal profile soundings (0m–1000m), and interactive geospatial heatmaps 
          across 24,000 spatial cells. A desktop or laptop display with GPU WebGL acceleration 
          (minimum resolution 1024px) is required for operational use.
        </p>

        <button
          onClick={handleCopyLink}
          style={{
            width: '100%',
            background: '#ffffff',
            border: '1px solid #f59e0b',
            color: '#78350f',
            padding: '10px 14px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          {copied ? <Check size={16} color="#15803d" /> : <Copy size={16} />}
          <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Link for Desktop Workstation'}</span>
        </button>
      </div>

      {/* Project Overview & Technical Architecture */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '18px 16px',
        marginBottom: 20,
        flex: 1,
      }}>
        <h3 style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          color: '#0c4a6e',
          marginTop: 0,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Layers size={17} color="#0284c7" />
          Technical Specifications
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.82rem' }}>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Model Architecture
            </span>
            <strong style={{ color: '#0f172a' }}>Spatiotemporal ConvLSTM + SFFM U-Net</strong>
            <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 2 }}>
              Temporal Scale Mixer with HASPP Multi-Scale Bottleneck
            </div>
          </div>

          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Vertical Ocean Water Column
            </span>
            <strong style={{ color: '#0f172a' }}>15 Standard Depth Layers (0m to 1000m)</strong>
            <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 2 }}>
              0m, 5m, 10m, 20m, 30m, 50m, 75m, 100m, 125m, 150m, 200m, 300m, 500m, 700m, 1000m
            </div>
          </div>

          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Geospatial Domain
            </span>
            <strong style={{ color: '#0f172a' }}>North Indian Ocean Basin</strong>
            <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 2 }}>
              5.0°N–29.75°N, 45.0°E–104.75°E (100 × 240 Grid, 0.25° resolution)
            </div>
          </div>

          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Input Satellite Observation Channels
            </span>
            <strong style={{ color: '#0f172a' }}>7 Dynamic Geophysical Variables (11-Day Matrix)</strong>
            <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 2 }}>
              SST, SSS, SLA, U/V 10m Winds, U/V Surface Currents + Land Mask
            </div>
          </div>

          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              In-Situ Scientific Verification
            </span>
            <strong style={{ color: '#0f172a' }}>INCOIS ARGO Autonomous Profiling Floats</strong>
            <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 2 }}>
              Validated against collocated physical float soundings and Copernicus GLORYS12V1 reanalysis
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        fontSize: '0.74rem',
        color: '#94a3b8',
        padding: '12px 0 6px',
      }}>
        <div>Ministry of Earth Sciences (MoES) · Government of India</div>
        <div style={{ marginTop: 2 }}>Indian National Centre for Ocean Information Services (INCOIS)</div>
      </div>
    </div>
  );
}
