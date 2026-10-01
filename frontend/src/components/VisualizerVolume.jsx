import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import 'echarts-gl';
import { Card, LoadingState, ErrorState, EmptyState, Select } from './ui';

const VisualizerVolume = ({ dataState, errorMsg }) => {
  const { status, metadata, slices } = dataState;
  const [activeDepthIndex, setActiveDepthIndex] = React.useState(0);

  React.useEffect(() => {
    if (metadata && metadata.depths && metadata.depths.length > 0) {
      setActiveDepthIndex(0);
    }
  }, [metadata]);

  if (status === 'idle') {
    return (
      <Card style={{ minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
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

  const data = [];
  const lons = metadata.longitudes;
  const lats = metadata.latitudes;
  
  let maxVal = -Infinity;
  let minVal = Infinity;
  
  // Surface plot needs all grid points. We'll use a baseline for missing data or skip them.
  for (let i = 0; i < lats.length; i++) { 
    for (let j = 0; j < lons.length; j++) { 
      const val = activeSlice.values[i][j];
      if (val !== null && val !== undefined && !isNaN(val)) {
         data.push([lons[j], lats[i], val]); 
         if (val > maxVal) maxVal = val;
         if (val < minVal) minVal = val;
      } else {
         // Push a low baseline value so the surface drops off sharply at the land
         data.push([lons[j], lats[i], -10]);
      }
    }
  }

  if (maxVal === -Infinity) maxVal = 30;
  if (minVal === Infinity) minVal = 0;

  const option = {
    tooltip: {
      formatter: (params) => {
        if (params.value[2] === -10) return 'Land';
        return `Lat: ${params.value[1].toFixed(2)}°N<br/>Lon: ${params.value[0].toFixed(2)}°E<br/>Temp: ${params.value[2].toFixed(2)}°C`;
      }
    },
    visualMap: {
      show: true,
      max: maxVal,
      min: minVal,
      inRange: {
        color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
      },
      calculable: true,
      textStyle: { color: '#333' }
    },
    xAxis3D: {
      type: 'value',
      name: 'Longitude',
      nameGap: 25,
      nameTextStyle: { color: '#333' },
      axisLabel: { textStyle: { color: '#333', fontSize: 10 } }
    },
    yAxis3D: {
      type: 'value',
      name: 'Latitude',
      nameGap: 25,
      nameTextStyle: { color: '#333' },
      axisLabel: { textStyle: { color: '#333', fontSize: 10 } }
    },
    zAxis3D: {
      type: 'value',
      name: 'Temp (°C)',
      nameGap: 25,
      min: minVal - 5, // Keep the baseline (-10) off the bottom scale slightly
      max: maxVal,
      nameTextStyle: { color: '#333' },
      axisLabel: { textStyle: { color: '#333', fontSize: 10 } }
    },
    grid3D: {
      boxWidth: 200,
      boxDepth: 200,
      boxHeight: 60,
      viewControl: {
        autoRotate: true,
        autoRotateSpeed: 5,
        alpha: 40,
        beta: 30,
        distance: 250
      },
      environment: '#ffffff',
      light: {
        main: { intensity: 1.2, shadow: true },
        ambient: { intensity: 0.6 }
      }
    },
    series: [
      {
        name: 'Ocean Surface',
        type: 'surface',
        data: data,
        shading: 'lambert',
        wireframe: { show: false }, // Turn off wireframe for a smooth, solid look
        itemStyle: { opacity: 0.95 }
      }
    ]
  };

  const depthOptions = metadata.depths.map((d, i) => ({
    value: i.toString(),
    label: `${d} meters`
  }));

  return (
    <Card style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '16px 16px 0', color: '#1e293b' }}>
        <div>
           <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>3D Smooth Surface</h3>
           <p style={{ fontSize: '0.875rem', marginTop: '4px', color: '#64748b' }}>
             Ocean Temperature Topology at {depthValue}m ({metadata.date})
           </p>
        </div>
        {depthOptions.length > 1 && (
          <div style={{ width: '200px' }}>
            <Select 
              id="surface-depth-select"
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

export default VisualizerVolume;
