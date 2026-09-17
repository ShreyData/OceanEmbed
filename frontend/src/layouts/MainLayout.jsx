import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const MainLayout = () => {
  const location = useLocation();

  const navLinks = [
    { path: '/explore', label: 'Explore Data' },
    { path: '/input', label: 'Input' },
    { path: '/results', label: 'Results' }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ 
        backgroundColor: 'var(--color-white)', 
        borderBottom: '1px solid var(--color-border)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <Link to="/" style={{ 
            textDecoration: 'none', 
            color: 'var(--color-slate-charcoal)',
            fontSize: '1.25rem',
            fontWeight: 700,
            letterSpacing: '-0.025em'
          }}>
            OceanEmbed
          </Link>
        </div>
        <nav style={{ display: 'flex', gap: '24px' }}>
          {navLinks.map((link) => (
            <Link 
              key={link.path} 
              to={link.path}
              style={{
                textDecoration: 'none',
                color: location.pathname === link.path ? 'var(--color-muted-teal)' : 'var(--color-slate-light)',
                fontWeight: location.pathname === link.path ? 600 : 500,
                fontSize: '0.9rem',
                transition: 'color 0.2s ease'
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main style={{ flex: 1, padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
