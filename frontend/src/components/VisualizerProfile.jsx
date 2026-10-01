import React, { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Card, Select, EmptyState } from './ui';

const VisualizerProfile = ({ dataState }) => {
  const { metadata, slices } = dataState;

  // Need at least 2 depth slices to draw a meaningful profile line
  if (!slices || slices.length < 2) {
    return (
      <Card style={{ minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState 
          title="Profile Unavailable" 
          description="Depth profile is not available for this result. (Requires multiple depth slices)" 
        />
      </Card>
    );
  }

  const [selectedLatIndex, setSelectedLatIndex] = useState(Math.floor(metadata.latitudes.length / 2));
  const [selectedLonIndex, setSelectedLonIndex] = useState(Math.floor(metadata.longitudes.length / 2));

  // Compute the temperature profile for the selected coordinate
  const profileData = useMemo(() => {
    const temps = [];
    const depths = [];

    slices.forEach(slice => {
      // slice.values is a 2D array [latIndex][lonIndex]
      const temp = slice.values[selectedLatIndex][selectedLonIndex];
      // Only include valid numbers (ignore nulls where it might be land)
      if (temp !== null && temp !== undefined) {
        temps.push(temp);
        depths.push(slice.depth_m);
      }
    });

    return { temps, depths };
  }, [slices, selectedLatIndex, selectedLonIndex]);

  const latOptions = metadata.latitudes.map((lat, i) => ({ value: i.toString(), label: `${lat}° N` }));
  const lonOptions = metadata.longitudes.map((lon, i) => ({ value: i.toString(), label: `${lon}° E` }));

  const plotData = [
    {
      x: profileData.temps,
      y: profileData.depths,
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: 'var(--color-muted-teal)', width: 3 },
      marker: { size: 8, color: 'var(--color-slate-charcoal)' },
      hovertemplate: '<b>Depth</b>: %{y}m<br><b>Temp</b>: %{x}°C<extra></extra>',
    }
  ];

  const plotLayout = {
    title: `Vertical Temperature Profile`,
    font: { family: 'Inter, sans-serif' },
    xaxis: { 
      title: 'Temperature',
      zeroline: false,
      automargin: true,
      ticksuffix: '°C'
    },
    yaxis: { 
      title: 'Depth', 
      autorange: 'reversed',
      zeroline: false,
      automargin: true,
      ticksuffix: 'm'
    },
    margin: { l: 60, r: 40, b: 60, t: 60 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    autosize: true,
    hovermode: 'closest'
  };

  return (
    <Card style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Temperature-Depth Profile</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-light)' }}>
            Select a coordinate to view vertical stratification.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Select 
            label="Latitude" 
            id="prof-lat-select"
            value={selectedLatIndex.toString()} 
            onChange={(e) => setSelectedLatIndex(parseInt(e.target.value))}
            options={latOptions}
          />
          <Select 
            label="Longitude" 
            id="prof-lon-select"
            value={selectedLonIndex.toString()} 
            onChange={(e) => setSelectedLonIndex(parseInt(e.target.value))}
            options={lonOptions}
          />
        </div>
      </div>
      
      <div style={{ flex: 1, minHeight: '500px', position: 'relative' }}>
        {profileData.temps.length > 0 ? (
          <Plot
            data={plotData}
            layout={plotLayout}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
            config={{ responsive: true, displayModeBar: false }}
          />
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyState 
              title="No Data at Coordinate" 
              description="This coordinate may be over land or outside the dataset bounds." 
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default VisualizerProfile;
