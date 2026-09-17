import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '48px 24px'
    }}>
      <h1 style={{
        fontSize: '3rem',
        fontWeight: 700,
        letterSpacing: '-0.025em',
        color: 'var(--color-slate-charcoal)',
        marginBottom: '16px'
      }}>
        OceanEmbed
      </h1>
      
      <p style={{
        fontSize: '1.25rem',
        color: 'var(--color-slate-light)',
        maxWidth: '600px',
        marginBottom: '24px',
        lineHeight: 1.6
      }}>
        Reconstruct the hidden ocean from surface observations.
      </p>

      <p style={{
        fontSize: '1rem',
        color: 'var(--color-slate-light)',
        maxWidth: '700px',
        marginBottom: '48px',
        lineHeight: 1.6
      }}>
        A scientific platform for deep ocean subsurface-temperature reconstruction.
        Leverage historical reference datasets or supply your own surface observations 
        to accurately predict volumetric thermal conditions.
      </p>

      <div style={{ display: 'flex', gap: '16px' }}>
        <Button 
          variant="primary" 
          onClick={() => navigate('/explore')}
          style={{ padding: '12px 24px', fontSize: '1rem' }}
        >
          Explore Ocean Data
        </Button>
        
        <Button 
          variant="secondary" 
          onClick={() => navigate('/input')}
          style={{ padding: '12px 24px', fontSize: '1rem' }}
        >
          Use Your Data
        </Button>
      </div>
    </div>
  );
};

export default LandingPage;
