import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Play, BookOpen } from 'lucide-react';

const MainLayout = () => {
  const location = useLocation();

  const isPredictActive = location.pathname === '/input';
  const isDocsActive = location.pathname === '/docs';
  const isResultsActive = location.pathname === '/results';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-off-white)' }}>
      {/* ── Top Header Bar ── */}
      <header style={{ 
        backgroundColor: '#ffffff', 
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
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
            src="/logo.png" 
            alt="OceanEmbed Logo" 
            style={{ 
              height: 38, 
              width: 'auto',
              maxHeight: 38,
              borderRadius: 6, 
              objectFit: 'contain',
              background: '#ffffff',
            }} 
          />
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#0c4a6e' }}>
              Ocean<span style={{ color: '#0284c7' }}>Embed</span>
            </span>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Subsurface Ocean AI Reconstruction
            </div>
          </div>
        </Link>

        {/* Quick Navigation Buttons (Right Corner) */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Documentation Button */}
          <Link
            to="/docs"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: isDocsActive ? '#0284c7' : '#334155',
              backgroundColor: isDocsActive ? '#e0f2fe' : '#f1f5f9',
              border: isDocsActive ? '1px solid #7dd3fc' : '1px solid #cbd5e1',
              transition: 'all 0.15s ease',
            }}
          >
            <BookOpen size={16} color={isDocsActive ? '#0284c7' : '#64748b'} />
            <span>Documentation</span>
          </Link>

          {/* Predict Data Button */}
          <Link
            to="/input"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              boxShadow: isPredictActive ? '0 0 0 2px #38bdf8, 0 3px 10px rgba(2, 132, 199, 0.4)' : '0 2px 6px rgba(2, 132, 199, 0.25)',
              border: '1px solid #0284c7',
              transition: 'all 0.15s ease',
            }}
          >
            <Play size={15} fill="#ffffff" />
            <span>Predict Data</span>
          </Link>

          {/* Active Dashboard Link if results exist */}
          {isResultsActive && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 6,
              background: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
              marginLeft: 4,
            }}>
              ● Dashboard Active
            </span>
          )}
        </nav>
      </header>

      {/* ── Main Content Area ── */}
      <main style={{ flex: 1, padding: '24px 32px', maxWidth: '1360px', margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>

      {/* ── Minimal Footer ── */}
      <footer style={{
        borderTop: '1px solid #e2e8f0',
        padding: '16px 32px',
        textAlign: 'center',
        fontSize: '0.78rem',
        color: '#94a3b8',
        backgroundColor: '#ffffff'
      }}>
        OceanEmbed · Physics-Informed 3D Subsurface Ocean Temperature Reconstruction · North Indian Ocean Domain (5°N–29.75°N, 45°E–104.75°E)
      </footer>
    </div>
  );
};

export default MainLayout;
