import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import 'echarts-gl';
import { Card, LoadingState, ErrorState, EmptyState, Select } from './ui';

const Visualizer3D = ({ dataState, errorMsg }) => {
  const { status, metadata, slices } = dataState;
  const [activeDepthIndex, setActiveDepthIndex] = useState(0);

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
        </div>
      </Card>
    );
  }

  if (status === 'loading') {
    return (
      <Card style={{ minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingState title="Streaming Data..." description={`Receiving 3D volume slices for ${metadata?.date || 'requested date'}.`} />
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

  const activeSlice = slices.find(s => s.depth_index === activeDepthIndex) || slices[0];
  const depthValue = metadata.depths[activeDepthIndex];

  // Convert 2D arrays to ECharts 3D format: [[x, y, z], ...]
  // We'll use array indices for x and y to map to longitudes and latitudes for the axis labels
  const waterData = [];
  const landData = [];
  const lons = metadata.longitudes;
  const lats = metadata.latitudes;
  
  let maxVal = -Infinity;
  let minVal = Infinity;
  
  // First pass: find min and max temperature
  for (let i = 0; i < lats.length; i++) { 
    for (let j = 0; j < lons.length; j++) { 
      const val = activeSlice.values[i][j];
      if (val !== null && val !== undefined && !isNaN(val)) {
         if (val > maxVal) maxVal = val;
         if (val < minVal) minVal = val;
      }
    }
  }

  if (maxVal === -Infinity) maxVal = 30;
  if (minVal === Infinity) minVal = 0;

  // Calculate a baseline height for land (slightly below the lowest temperature)
  const landHeight = minVal - ((maxVal - minVal) * 0.1);
  const zMin = landHeight - 0.2; // Ensure zAxis minimum is lower than landHeight so land tiles have thickness > 0

  // Second pass: construct data for water and land series
  for (let i = 0; i < lats.length; i++) { // y (latitude)
    for (let j = 0; j < lons.length; j++) { // x (longitude)
      const val = activeSlice.values[i][j];
      if (val !== null && val !== undefined && !isNaN(val)) {
         waterData.push([j, i, val]);
      } else {
         landData.push([j, i, landHeight]);
      }
    }
  }

  const option = {
    tooltip: {},
    visualMap: {
      show: true,
      seriesIndex: 0, // Apply color map ONLY to the water series
      max: maxVal,
      min: minVal,
      inRange: {
        color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
      },
      calculable: true,
      realtime: false,
      textStyle: {
        color: '#333'
      }
    },
    xAxis3D: {
      type: 'category',
      data: lons.map(l => `${l.toFixed(1)}°E`),
      name: 'Longitude',
      nameGap: 25,
      nameTextStyle: { color: '#333' },
      axisLabel: { 
        textStyle: { color: '#333', fontSize: 10 }, 
        margin: 8,
        interval: Math.max(1, Math.floor(lons.length / 6)) // Show ~6 labels max
      }
    },
    yAxis3D: {
      type: 'category',
      data: lats.map(l => `${l.toFixed(1)}°N`),
      name: 'Latitude',
      nameGap: 25,
      nameTextStyle: { color: '#333' },
      axisLabel: { 
        textStyle: { color: '#333', fontSize: 10 }, 
        margin: 8,
        interval: Math.max(1, Math.floor(lats.length / 6)) // Show ~6 labels max
      }
    },
    zAxis3D: {
      type: 'value',
      name: 'Temp (°C)',
      nameGap: 25,
      min: zMin,
      splitNumber: 4, // Reduce number of vertical ticks
      nameTextStyle: { color: '#333' },
      axisLabel: { 
        textStyle: { color: '#333', fontSize: 10 },
        formatter: (value) => Math.round(value) // Prevent long float numbers
      }
    },
    grid3D: {
      boxWidth: 200,
      boxDepth: 200,
      boxHeight: 60, // Flatten the box height to prevent extreme spikes
      viewControl: {
        autoRotate: true,
        autoRotateSpeed: 5,
        alpha: 50, // Slightly more top-down
        beta: 30,
        distance: 250 // Zoom out a bit to fit everything
      },
      light: {
        main: {
          intensity: 0.9, // Reduced from 1.5 to prevent blowout
          shadow: true,
          shadowQuality: 'medium',
          alpha: 30
        },
        ambient: {
          intensity: 0.4 // Reduced from 0.6
        }
      }
    },
    series: [
      {
        name: 'Water',
        type: 'bar3D',
        data: waterData,
        shading: 'lambert',
        label: { show: false },
        itemStyle: { opacity: 0.95 },
        barSize: 0.8, // Slightly thinner bars to show the grid
      },
      {
        name: 'Land',
        type: 'bar3D',
        data: landData,
        shading: 'lambert',
        label: { show: false },
        itemStyle: {
          color: '#94a3b8', // Darker slate gray so it stands out against the white bg
          opacity: 1
        },
        barSize: 1, // Full size for the base floor
      }
    ]
  };

  const depthOptions = metadata.depths.map((d, i) => ({
    value: i.toString(),
    label: `${d} meters`
  }));

  return (
    <Card style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '16px 16px 0', color: '#1e293b' }}>
        <div>
           <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>3D Bar Visualization</h3>
           <p style={{ fontSize: '0.875rem', marginTop: '4px', color: '#64748b' }}>
             Ocean Temperature at {depthValue}m ({metadata.date})
           </p>
        </div>
        {depthOptions.length > 1 && (
          <div style={{ width: '200px' }}>
            <Select 
              id="viz-depth-select"
              value={activeDepthIndex.toString()} 
              onChange={(e) => setActiveDepthIndex(parseInt(e.target.value))}
              options={depthOptions}
              style={{ color: '#000' }}
            />
          </div>
        )}
      </div>
      
      <div style={{ flex: 1, minHeight: '500px', position: 'relative', overflow: 'hidden' }}>
        <ReactECharts 
          option={option} 
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
        />
      </div>
    </Card>
  );
};

export default Visualizer3D;
