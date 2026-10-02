import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Play, BookOpen, Compass, BarChart3, Database } from 'lucide-react';
import logoImg from '../assets/logo_tight.png';

const MainLayout = () => {
  const location = useLocation();

  const isPredictActive = location.pathname === '/input';
  const isDocsActive = location.pathname === '/docs' || location.pathname === '/documentation';
  const isResultsActive = location.pathname === '/results';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-off-white)' }}>
      {/* ── Top Header Bar ── */}
      <header style={{ 
        backgroundColor: '#ffffff', 
        borderBottom: '1px solid #e2e8f0',
        padding: '10px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Brand / Logo */}
        <Link to="/" style={{ 
          textDecoration: 'none', 
          color: 'var(--color-ocean-abyss)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <img 
            src={logoImg} 
            alt="OceanEmbed Logo" 
            style={{ 
              height: 42, 
              width: 'auto',
              maxHeight: 42,
              objectFit: 'contain',
              display: 'block',
            }} 
          />
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#0c4a6e', lineHeight: 1.15 }}>
              Ocean<span style={{ color: '#0284c7' }}>Embed</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Subsurface Ocean Thermal Profiling
            </div>
          </div>
        </Link>

        {/* Center / Right Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          
          {/* Operational Status Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            fontSize: '0.72rem',
            color: '#166534',
            fontWeight: 600,
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)',
              display: 'inline-block'
            }} />
            <span>AWS Inference Engine Active</span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Documentation Button */}
            <Link
              to="/docs"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: isDocsActive ? '#0284c7' : '#475569',
                backgroundColor: isDocsActive ? '#e0f2fe' : 'transparent',
                border: isDocsActive ? '1px solid #bae6fd' : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <BookOpen size={15} color={isDocsActive ? '#0284c7' : '#64748b'} />
              <span>Docs</span>
            </Link>

            {/* Results Button (if results exist) */}
            {isResultsActive && (
              <Link
                to="/results"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: '#0284c7',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                }}
              >
                <BarChart3 size={15} color="#0284c7" />
                <span>Active Results</span>
              </Link>
            )}

            {/* Predict Data Button (Primary) */}
            <Link
              to="/input"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 700,
                textDecoration: 'none',
                color: '#ffffff',
                backgroundColor: '#0284c7',
                border: '1px solid #0284c7',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              <Play size={14} fill="#ffffff" />
              <span>Launch Studio</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main style={{ flex: 1, padding: '24px 28px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <Outlet />
      </main>

      {/* ── Institutional Footer ── */}
      <footer style={{
        borderTop: '1px solid #e2e8f0',
        padding: '14px 28px',
        textAlign: 'center',
        fontSize: '0.78rem',
        color: '#64748b',
        backgroundColor: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={logoImg} alt="OceanEmbed" style={{ height: 18, width: 'auto' }} />
          <span>OceanEmbed · Subsurface Ocean Thermal Reconstruction Platform</span>
        </div>
        <div>
          Ministry of Earth Sciences (MoES) · Indian National Centre for Ocean Information Services (INCOIS)
        </div>
        <div>
          Domain: North Indian Ocean (5°N–29.75°N, 45°E–104.75°E) · 15 Depth Layers (0m–1000m)
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
