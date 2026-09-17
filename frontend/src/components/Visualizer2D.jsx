import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { Card, LoadingState, ErrorState, EmptyState, Select } from './ui';

const Visualizer2D = ({ dataState, errorMsg }) => {
  const { status, metadata, slices } = dataState;
  const [activeDepthIndex, setActiveDepthIndex] = useState(0);

  // When new data loads, default to the first available depth
  useEffect(() => {
    if (metadata && metadata.depths && metadata.depths.length > 0) {
      setActiveDepthIndex(0);
    }
  }, [metadata]);

  if (status === 'idle') {
    return (
      <Card style={{ minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-off-white)' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-slate-light)' }}>
          <p>Select parameters and click "Fetch 3D Volume" to visualize data.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>
            Queries will be sent to the backend matching the exact grid limits above.
          </p>
        </div>
      </Card>
    );
  }

  if (status === 'loading') {
    return (
      <Card style={{ minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingState 
          title="Streaming Data..." 
          description={`Receiving 3D volume slices for ${metadata?.date || 'requested date'}.`} 
        />
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card style={{ minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorState title="Visualization Error" description={errorMsg || "Failed to load data"} />
      </Card>
    );
  }

  if (status === 'empty' || !metadata || slices.length === 0) {
    return (
      <Card style={{ minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState title="No Data Found" description="The server returned no data for the requested parameters." />
      </Card>
    );
  }

  // Find the active slice
  const activeSlice = slices.find(s => s.depth_index === activeDepthIndex) || slices[0];
  const depthValue = metadata.depths[activeDepthIndex];

  // We want to flip Y-axis if necessary, but Plotly Heatmap handles lat/lon arrays.
  // Z is a 2D array of values.
  const plotData = [
    {
      z: activeSlice.values,
      x: metadata.longitudes,
      y: metadata.latitudes,
      type: 'heatmap',
      colorscale: 'Viridis',
      hoverongaps: false,
      colorbar: {
        title: 'Temp',
        titleside: 'right',
        ticksuffix: '°C'
      }
    }
  ];

  const plotLayout = {
    title: `Ocean Temperature at ${depthValue}m (${metadata.date})`,
    font: { family: 'Inter, sans-serif' },
    xaxis: { title: 'Longitude', constrain: 'domain', automargin: true, ticksuffix: '°E' },
    yaxis: { title: 'Latitude', scaleanchor: 'x', scaleratio: 1, automargin: true, ticksuffix: '°N' },
    margin: { l: 60, r: 60, b: 60, t: 60 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    autosize: true
  };

  const depthOptions = metadata.depths.map((d, i) => ({
    value: i.toString(),
    label: `${d} meters`
  }));

  return (
    <Card style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>2D Slice Visualization</h3>
        {depthOptions.length > 1 && (
          <div style={{ width: '200px' }}>
            <Select 
              id="viz-depth-select"
              value={activeDepthIndex.toString()} 
              onChange={(e) => setActiveDepthIndex(parseInt(e.target.value))}
              options={depthOptions}
            />
          </div>
        )}
      </div>
      
      <div style={{ flex: 1, minHeight: '500px', position: 'relative' }}>
        <Plot
          data={plotData}
          layout={plotLayout}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </div>
    </Card>
  );
};

export default Visualizer2D;
