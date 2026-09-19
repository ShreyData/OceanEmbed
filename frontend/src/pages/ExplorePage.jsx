import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, Input, Select, Button, Badge, LoadingState, ErrorState, Tabs } from '../components/ui';
import { fetchMetadata, fetchHistoricalData } from '../api/client';
import Visualizer2D from '../components/Visualizer2D';
import Visualizer3D from '../components/Visualizer3D';
import VisualizerProfile from '../components/VisualizerProfile';
import VisualizerVolume from '../components/VisualizerVolume';

const ExplorePage = () => {
  const [initStatus, setInitStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [initError, setInitError] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [activeTab, setActiveTab] = useState('slice');

  // Form State
  const [query, setQuery] = useState({
    date: '',
    lat_min: '',
    lat_max: '',
    lon_min: '',
    lon_max: '',
    depth: ''
  });

  // Visualization State
  const [vizState, setVizState] = useState({
    status: 'idle', // 'idle', 'loading', 'success', 'error', 'empty'
    metadata: null,
    slices: []
  });
  const [vizError, setVizError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchMetadata();
        setMetadata(data);
        
        // Initialize form with defaults based on metadata
        setQuery({
          date: data.dates.min_date,
          lat_min: data.bounds.latitude.min.toString(),
          lat_max: data.bounds.latitude.max.toString(),
          lon_min: data.bounds.longitude.min.toString(),
          lon_max: data.bounds.longitude.max.toString(),
          depth: '' // Empty string means all depths
        });
        
        setInitStatus('success');
      } catch (err) {
        setInitError(err.message || 'Failed to connect to the OceanEmbed backend.');
        setInitStatus('error');
      }
    };
    
    loadData();
  }, []);

  const handleChange = (field, value) => {
    setQuery(prev => ({ ...prev, [field]: value }));
  };

  const handleFetch = async () => {
    setVizState({ status: 'loading', metadata: null, slices: [] });
    setVizError('');

    await fetchHistoricalData(
      {
        date: query.date,
        lat_min: query.lat_min,
        lat_max: query.lat_max,
        lon_min: query.lon_min,
        lon_max: query.lon_max,
        depths: query.depth
      },
      {
        onMetadata: (meta) => {
          setVizState(prev => ({ ...prev, metadata: meta }));
        },
        onSlice: (slice) => {
          setVizState(prev => ({ 
            ...prev, 
            slices: [...prev.slices, slice] 
          }));
        },
        onComplete: (complete) => {
          setVizState(prev => ({ 
            ...prev, 
            status: prev.slices.length > 0 ? 'success' : 'empty' 
          }));
        },
        onError: (err) => {
          setVizError(err.message || 'Failed to fetch visualization data');
          setVizState(prev => ({ ...prev, status: 'error' }));
        }
      }
    );
  };

  if (initStatus === 'loading') {
    return (
      <div style={{ paddingTop: '100px' }}>
        <LoadingState 
          title="Connecting to Backend" 
          description="Fetching dataset metadata and grid configurations..." 
        />
      </div>
    );
  }

  if (initStatus === 'error') {
    return (
      <div style={{ paddingTop: '100px' }}>
        <ErrorState 
          title="Connection Failed" 
          description={initError} 
        />
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Button onClick={() => window.location.reload()}>Retry Connection</Button>
        </div>
      </div>
    );
  }

  if (!metadata) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Explore Ocean Data</h1>
        <p className="text-slate-light">Access historical subsurface temperature profiles from our reference database.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '32px' }}>
        {/* Controls Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card>
            <CardHeader>
              <CardTitle>Query Parameters</CardTitle>
            </CardHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input 
                label="Target Date" 
                type="date" 
                value={query.date}
                min={metadata.dates.min_date}
                max={metadata.dates.max_date}
                onChange={(e) => handleChange('date', e.target.value)}
              />
              
              <div>
                <label className="label">Bounding Box (Lat/Lon)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Input 
                    placeholder="Lat Min" 
                    type="number"
                    step={metadata.bounds.latitude.step}
                    min={metadata.bounds.latitude.min}
                    max={metadata.bounds.latitude.max}
                    value={query.lat_min}
                    onChange={(e) => handleChange('lat_min', e.target.value)}
                  />
                  <Input 
                    placeholder="Lat Max" 
                    type="number"
                    step={metadata.bounds.latitude.step}
                    min={metadata.bounds.latitude.min}
                    max={metadata.bounds.latitude.max}
                    value={query.lat_max}
                    onChange={(e) => handleChange('lat_max', e.target.value)}
                  />
                  <Input 
                    placeholder="Lon Min" 
                    type="number"
                    step={metadata.bounds.longitude.step}
                    min={metadata.bounds.longitude.min}
                    max={metadata.bounds.longitude.max}
                    value={query.lon_min}
                    onChange={(e) => handleChange('lon_min', e.target.value)}
                  />
                  <Input 
                    placeholder="Lon Max" 
                    type="number"
                    step={metadata.bounds.longitude.step}
                    min={metadata.bounds.longitude.min}
                    max={metadata.bounds.longitude.max}
                    value={query.lon_max}
                    onChange={(e) => handleChange('lon_max', e.target.value)}
                  />
                </div>
              </div>

              <Select 
                label="Target Depth" 
                value={query.depth}
                onChange={(e) => handleChange('depth', e.target.value)}
                options={[
                  { value: '', label: 'All Depths (0-1000m)' },
                  ...metadata.depths.map(d => ({ value: d.toString(), label: `${d} meters` }))
                ]}
              />

              <Button 
                variant="primary" 
                style={{ width: '100%', marginTop: '8px' }}
                onClick={handleFetch}
                disabled={!query.date || vizState.status === 'loading'}
              >
                {vizState.status === 'loading' ? 'Streaming...' : 'Fetch 3D Volume'}
              </Button>
            </div>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Dataset Info</CardTitle>
            </CardHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span className="text-slate-light" style={{ whiteSpace: 'nowrap' }}>Date Range:</span>
                <span style={{ textAlign: 'right' }}>{metadata.dates.min_date} to {metadata.dates.max_date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span className="text-slate-light" style={{ whiteSpace: 'nowrap' }}>Lat Bounds:</span>
                <span style={{ textAlign: 'right' }}>{metadata.bounds.latitude.min}° to {metadata.bounds.latitude.max}°</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span className="text-slate-light" style={{ whiteSpace: 'nowrap' }}>Lon Bounds:</span>
                <span style={{ textAlign: 'right' }}>{metadata.bounds.longitude.min}° to {metadata.bounds.longitude.max}°</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span className="text-slate-light" style={{ whiteSpace: 'nowrap' }}>Resolution:</span>
                <span style={{ textAlign: 'right' }}>{metadata.bounds.latitude.step}° x {metadata.bounds.longitude.step}°</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span className="text-slate-light" style={{ whiteSpace: 'nowrap' }}>Depths:</span>
                <span style={{ textAlign: 'right' }}>{metadata.depths.length} standard levels</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                <span className="text-slate-light" style={{ whiteSpace: 'nowrap' }}>Variable:</span>
                <Badge variant="neutral">Temperature (thetao)</Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Visualizations with Tabs */}
        <div style={{ width: '100%', minWidth: 0 }}>
          <Tabs 
            tabs={[
              { 
                id: 'slice', 
                label: '2D Depth Slice', 
                content: <Visualizer2D dataState={vizState} errorMsg={vizError} />
              },
              { 
                id: 'slice3d', 
                label: '3D Visualization', 
                content: <Visualizer3D dataState={vizState} errorMsg={vizError} />
              },
              {
                id: 'volume',
                label: '3D Surface',
                content: <VisualizerVolume dataState={vizState} errorMsg={vizError} />
              },
              { 
                id: 'profile', 
                label: 'Vertical Profile', 
                content: <VisualizerProfile dataState={vizState} />
              }
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id)}
          />
        </div>
      </div>
    </div>
  );
};

export default ExplorePage;
