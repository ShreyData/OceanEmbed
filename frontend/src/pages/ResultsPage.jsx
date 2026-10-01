import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as echarts from 'echarts';
import 'echarts-gl';

const DEPTH_LEVELS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
const THERMAL_COLORS = ['#000080', '#0000FF', '#00BFFF', '#00FFFF', '#7FFF00', '#FFFF00', '#FF8C00', '#FF0000', '#8B0000'];

/**
 * Robust React wrapper for Apache ECharts that works cleanly in React 19
 * without the lifecycle/cleanup bugs of legacy echarts-for-react.
 */
function EChart({ option, style, onEvents, notMerge = true }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let chart = chartRef.current;
    if (!chart) {
      chart = echarts.init(containerRef.current);
      chartRef.current = chart;
    }

    if (onEvents) {
      Object.entries(onEvents).forEach(([eventName, handler]) => {
        chart.off(eventName);
        chart.on(eventName, handler);
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      chart?.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && option) {
      try {
        chartRef.current.setOption(option, notMerge);
      } catch (err) {
        console.warn('ECharts setOption error:', err);
      }
    }
  }, [option, notMerge]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />;
}

function StatCard({ label, value, unit = '', color }) {
  return (
    <div style={{
      background: 'var(--color-card)', border: '1px solid var(--color-border)',
      borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: color || 'inherit' }}>
        {value}<span style={{ fontSize: '0.8rem', fontWeight: 400, marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize data immediately from navigation state, window, or sessionStorage
  const [data, setData] = useState(() => {
    if (location.state?.prediction) return location.state.prediction;
    if (typeof window !== 'undefined' && window.__PREDICTION_RESULT__) return window.__PREDICTION_RESULT__;
    try {
      const stored = sessionStorage.getItem('oceanembed_last_prediction');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [activeDepthIdx, setActiveDepthIdx] = useState(0);
  const [profile, setProfile] = useState(null);
  const [latRange, setLatRange] = useState([5.0, 29.75]);
  const [lonRange, setLonRange] = useState([45.0, 104.75]);
  const [selectedDepths, setSelectedDepths] = useState(new Set(DEPTH_LEVELS));
  const [pointSize, setPointSize] = useState(3);
  const [glSupported, setGlSupported] = useState(true);

  // Sync to sessionStorage so page refresh doesn't lose predictions
  useEffect(() => {
    if (data && data.status === 'success') {
      try {
        sessionStorage.setItem('oceanembed_last_prediction', JSON.stringify(data));
      } catch (e) {
        // quota exceeded or private mode, safe to ignore
      }
    }
  }, [data]);

  // Check if data is missing
  if (!data || data.status !== 'success') {
    return (
      <div style={{ paddingTop: 80, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <h2>No Results Available</h2>
        <p style={{ color: 'var(--color-slate-light)' }}>
          Run an inference prediction from the Upload Data page to view results.
        </p>
        <button
          onClick={() => navigate('/input')}
          style={{
            marginTop: 16, background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: '1rem',
          }}
        >
          Go to Upload Data
        </button>
      </div>
    );
  }

  const { latency_ms = 0, depth_levels = DEPTH_LEVELS, grid = {}, summary = {}, predictions = {} } = data;
  const lats = grid.lat || [];
  const lons = grid.lon || [];
  const depthKey = `${DEPTH_LEVELS[activeDepthIdx]}m`;
  const depthData = predictions[depthKey] || [];

  /* ── 2D Heatmap data preparation (safe loop, no recursion/callstack limits) ── */
  const heatmapData = useMemo(() => {
    const res = [];
    if (!Array.isArray(depthData)) return res;
    for (let latI = 0; latI < depthData.length; latI++) {
      const row = depthData[latI];
      if (!Array.isArray(row)) continue;
      for (let lonI = 0; lonI < row.length; lonI++) {
        const val = row[lonI];
        if (val !== null && val !== undefined && !Number.isNaN(val)) {
          res.push([lonI, latI, Number(Number(val).toFixed(2))]);
        }
      }
    }
    return res;
  }, [depthData]);

  const tempMin = summary.deep_temp_min != null ? summary.deep_temp_min : 3;
  const tempMax = summary.surface_temp_max != null ? summary.surface_temp_max : 32;

  /* ── Current depth stats calculated safely with a simple loop ── */
  const { depthMin, depthMax } = useMemo(() => {
    if (heatmapData.length === 0) return { depthMin: '-', depthMax: '-' };
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < heatmapData.length; i++) {
      const v = heatmapData[i][2];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return {
      depthMin: min !== Infinity ? min.toFixed(1) : '-',
      depthMax: max !== -Infinity ? max.toFixed(1) : '-',
    };
  }, [heatmapData]);

  /* ── Heatmap click handler ── */
  const onHeatmapClick = useCallback((params) => {
    if (params.componentType !== 'series' || !params.data) return;
    const [lonIdx, latIdx] = params.data;
    const lat = lats[latIdx];
    const lon = lons[lonIdx];
    if (lat == null || lon == null) return;

    const temps = DEPTH_LEVELS.map((d) => {
      const key = `${d}m`;
      const gridMatrix = predictions[key];
      if (!gridMatrix || !gridMatrix[latIdx]) return null;
      return gridMatrix[latIdx][lonIdx];
    });

    setProfile({ lat: lat.toFixed(2), lon: lon.toFixed(2), temps });
  }, [predictions, lats, lons]);

  /* ── 2D Heatmap ECharts option ── */
  const heatmapOption = useMemo(() => ({
    backgroundColor: 'transparent',
    title: {
      text: `Ocean Temperature at ${DEPTH_LEVELS[activeDepthIdx]}m Depth`,
      left: 'center',
      textStyle: { fontSize: 14, color: '#333' }
    },
    tooltip: {
      formatter: (p) => {
        if (!p.data) return '';
        const lon = lons[p.data[0]];
        const lat = lats[p.data[1]];
        const temp = p.data[2];
        return `<b>Lon:</b> ${lon?.toFixed(2)}°E<br/><b>Lat:</b> ${lat?.toFixed(2)}°N<br/><b>Temp:</b> ${temp?.toFixed(2)}°C`;
      },
    },
    grid: { top: 50, bottom: 60, left: 65, right: 120 },
    xAxis: {
      type: 'category',
      data: lons.map((v, i) => (i % 20 === 0 ? `${v.toFixed(1)}°E` : '')),
      name: 'Longitude',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { interval: 0 },
    },
    yAxis: {
      type: 'category',
      data: lats.map((v, i) => (i % 10 === 0 ? `${v.toFixed(1)}°N` : '')),
      name: 'Latitude',
      nameLocation: 'middle',
      nameGap: 45,
      axisLabel: { interval: 0 },
    },
    visualMap: {
      min: tempMin,
      max: tempMax,
      calculable: true,
      orient: 'vertical',
      right: 10,
      top: 'middle',
      inRange: { color: THERMAL_COLORS },
      text: [`${tempMax.toFixed(0)}°C`, `${tempMin.toFixed(0)}°C`],
      textStyle: { fontSize: 11 },
    },
    series: [{
      type: 'heatmap',
      data: heatmapData,
      emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
      progressive: 2000,
      animation: false,
    }],
  }), [activeDepthIdx, lons, lats, tempMin, tempMax, heatmapData]);

  /* ── 3D Scatter data calculation ── */
  const scatter3dData = useMemo(() => {
    if (!lats.length || !lons.length) return [];
    const res = [];
    const depthStep = Math.max(1, Math.floor(lats.length / 25));
    const lonStep = Math.max(1, Math.floor(lons.length / 40));

    for (let latI = 0; latI < lats.length; latI += depthStep) {
      const lat = lats[latI];
      if (lat < latRange[0] || lat > latRange[1]) continue;
      for (let lonI = 0; lonI < lons.length; lonI += lonStep) {
        const lon = lons[lonI];
        if (lon < lonRange[0] || lon > lonRange[1]) continue;
        DEPTH_LEVELS.forEach((depth) => {
          if (!selectedDepths.has(depth)) return;
          const key = `${depth}m`;
          const matrix = predictions[key];
          if (!matrix || !matrix[latI]) return;
          const val = matrix[latI][lonI];
          if (val !== null && val !== undefined && !Number.isNaN(val)) {
            res.push([lon, lat, -depth, Number(Number(val).toFixed(2))]);
          }
        });
      }
    }
    return res;
  }, [lats, lons, latRange, lonRange, selectedDepths, predictions]);

  const scatter3dOption = useMemo(() => ({
    backgroundColor: '#0a0a1a',
    tooltip: {
      formatter: (p) => {
        if (!p.data) return '';
        const [lon, lat, depth, temp] = p.data;
        return `Lon: ${lon}°E<br/>Lat: ${lat}°N<br/>Depth: ${Math.abs(depth)}m<br/>Temp: ${temp.toFixed(2)}°C`;
      },
    },
    visualMap: {
      min: tempMin,
      max: tempMax,
      dimension: 3,
      inRange: { color: THERMAL_COLORS },
      textStyle: { color: '#ccc', fontSize: 11 },
      orient: 'vertical',
      right: 10,
      top: 'middle',
    },
    xAxis3D: {
      type: 'value',
      name: 'Longitude (°E)',
      nameTextStyle: { color: '#aaa' },
      axisLine: { lineStyle: { color: '#444' } },
    },
    yAxis3D: {
      type: 'value',
      name: 'Latitude (°N)',
      nameTextStyle: { color: '#aaa' },
      axisLine: { lineStyle: { color: '#444' } },
    },
    zAxis3D: {
      type: 'value',
      name: 'Depth (m)',
      nameTextStyle: { color: '#aaa' },
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { formatter: (v) => `${Math.abs(v)}m` },
      min: -1010,
      max: 0,
    },
    grid3D: {
      boxWidth: 200,
      boxDepth: 80,
      boxHeight: 80,
      viewControl: { autoRotate: false, distance: 250, alpha: 20, beta: 30 },
      light: {
        main: { intensity: 1.5, shadow: false },
        ambient: { intensity: 0.5 },
      },
    },
    series: [{
      type: 'scatter3D',
      data: scatter3dData,
      symbolSize: pointSize,
      itemStyle: { opacity: 0.85 },
      emphasis: { itemStyle: { opacity: 1, symbolSize: pointSize + 2 } },
    }],
  }), [tempMin, tempMax, scatter3dData, pointSize]);

  /* ── Vertical Profile ECharts option ── */
  const profileOption = useMemo(() => {
    if (!profile) return null;
    const cleanPoints = profile.temps
      .map((t, i) => (t !== null && !Number.isNaN(t) ? [t, -DEPTH_LEVELS[i]] : null))
      .filter(Boolean);

    return {
      title: {
        text: `Thermal Profile at ${profile.lat}°N, ${profile.lon}°E`,
        textStyle: { fontSize: 13, color: '#333' }
      },
      tooltip: {
        formatter: (p) => `Depth: ${Math.abs(p.data[1])}m<br/>Temp: ${p.data[0]?.toFixed(2)}°C`
      },
      grid: { top: 50, bottom: 50, left: 75, right: 30 },
      xAxis: {
        type: 'value',
        name: 'Temperature (°C)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLine: { onZero: true },
      },
      yAxis: {
        type: 'value',
        name: 'Depth (m)',
        nameLocation: 'middle',
        nameGap: 55,
        min: -1010,
        max: 5,
        axisLabel: { formatter: (v) => `${Math.abs(v)}m` },
      },
      series: [{
        type: 'line',
        smooth: true,
        data: cleanPoints,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#1890ff', width: 2.5 },
        itemStyle: { color: '#1890ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: 'rgba(24,144,255,0.3)' },
            { offset: 1, color: 'rgba(24,144,255,0)' },
          ]),
        },
        markLine: {
          data: [{ xAxis: 0 }],
          lineStyle: { color: '#f5222d', type: 'dashed' },
          label: { formatter: '0°C' },
        },
      }],
    };
  }, [profile]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '1.8rem' }}>OceanEmbed Analysis Results</h1>
          <p style={{ margin: 0, color: 'var(--color-slate-light)' }}>
            3D subsurface ocean temperature reconstruction — North Indian Ocean
          </p>
        </div>
        <button
          onClick={() => navigate('/input')}
          style={{
            background: 'var(--color-primary)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600,
          }}
        >
          New Prediction
        </button>
      </div>

      {/* ── Benchmark banner ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Inference Latency" value={`~${Number(latency_ms).toFixed(0)}`} unit="ms" color="#1890ff" />
        <StatCard label="Checkpoint Size" value="9.87" unit="MB" />
        <StatCard label="Depth Levels" value="15" unit="layers (0–1000m)" />
        <StatCard label="Grid Resolution" value="100×240" unit="| 0.25°" />
        <StatCard label="Surface Min" value={summary.surface_temp_min != null ? summary.surface_temp_min.toFixed(1) : '-'} unit="°C" color="#52c41a" />
        <StatCard label="Surface Max" value={summary.surface_temp_max != null ? summary.surface_temp_max.toFixed(1) : '-'} unit="°C" color="#f5222d" />
        <StatCard label="Deep (1000m) Min" value={summary.deep_temp_min != null ? summary.deep_temp_min.toFixed(1) : '-'} unit="°C" color="#1890ff" />
      </div>

      {/* ── Depth layer selector ── */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-light)', marginBottom: 10 }}>Select Depth Layer</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DEPTH_LEVELS.map((d, i) => (
            <button
              key={d}
              onClick={() => setActiveDepthIdx(i)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                background: i === activeDepthIdx ? 'var(--color-primary)' : 'var(--color-off-white)',
                color: i === activeDepthIdx ? '#fff' : 'inherit',
                transition: 'all 0.2s',
              }}
            >
              {d}m
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--color-slate-light)' }}>
          Selected layer ({DEPTH_LEVELS[activeDepthIdx]}m) — Min: <strong>{depthMin}°C</strong> &nbsp;|&nbsp; Max: <strong>{depthMax}°C</strong>
        </div>
      </div>

      {/* ── 2D Heatmap ── */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
          🗺️ Thermal Heatmap — {DEPTH_LEVELS[activeDepthIdx]}m Layer
        </div>
        <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-slate-light)' }}>
          Click any ocean coordinate on the heatmap to view its complete vertical temperature sounding (0m to 1000m) below.
        </p>
        <div style={{ height: 420 }}>
          <EChart
            option={heatmapOption}
            onEvents={{ click: onHeatmapClick }}
          />
        </div>
      </div>

      {/* ── 3D Visualization ── */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>
          🌐 3D Ocean Temperature Field & Subsurface Volume
        </div>

        {/* Filter controls */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16, marginBottom: 16, padding: 16, background: 'var(--color-off-white)', borderRadius: 8
        }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', display: 'block', marginBottom: 4 }}>
              Latitude: {latRange[0].toFixed(1)}°N – {latRange[1].toFixed(1)}°N
            </label>
            <input
              type="range" min={5} max={29.75} step={0.25} value={latRange[0]}
              onChange={e => setLatRange([Math.min(+e.target.value, latRange[1] - 0.5), latRange[1]])}
              style={{ width: '48%', marginRight: '4%' }}
            />
            <input
              type="range" min={5} max={29.75} step={0.25} value={latRange[1]}
              onChange={e => setLatRange([latRange[0], Math.max(+e.target.value, latRange[0] + 0.5)])}
              style={{ width: '48%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', display: 'block', marginBottom: 4 }}>
              Longitude: {lonRange[0].toFixed(1)}°E – {lonRange[1].toFixed(1)}°E
            </label>
            <input
              type="range" min={45} max={104.75} step={0.25} value={lonRange[0]}
              onChange={e => setLonRange([Math.min(+e.target.value, lonRange[1] - 0.5), lonRange[1]])}
              style={{ width: '48%', marginRight: '4%' }}
            />
            <input
              type="range" min={45} max={104.75} step={0.25} value={lonRange[1]}
              onChange={e => setLonRange([lonRange[0], Math.max(+e.target.value, lonRange[0] + 0.5)])}
              style={{ width: '48%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', display: 'block', marginBottom: 4 }}>
              Depth Layers (toggle)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {DEPTH_LEVELS.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDepths(prev => {
                    const next = new Set(prev);
                    next.has(d) ? next.delete(d) : next.add(d);
                    return next;
                  })}
                  style={{
                    padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                    background: selectedDepths.has(d) ? '#1890ff' : '#d9d9d9',
                    color: selectedDepths.has(d) ? '#fff' : '#666',
                  }}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', display: 'block', marginBottom: 4 }}>
              Point Resolution Size: {pointSize}px
            </label>
            <input
              type="range" min={1} max={8} step={1} value={pointSize}
              onChange={e => setPointSize(+e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {glSupported ? (
          <div style={{ height: 500, borderRadius: 8, overflow: 'hidden' }}>
            <EChart option={scatter3dOption} />
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', background: '#fafafa', borderRadius: 8, color: '#888' }}>
            WebGL 3D acceleration is not available on this browser/GPU.
          </div>
        )}
        <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: 'var(--color-slate-light)', textAlign: 'center' }}>
          Drag to rotate 3D view · Scroll to zoom · Thermal ramp encodes temperature (°C) · Inverted Z-axis reflects ocean depth
        </p>
      </div>

      {/* ── Vertical Profile ── */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
          📉 Vertical Thermal Profile Sounding (0m – 1000m)
        </div>
        {profileOption ? (
          <>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-slate-light)' }}>
              Station Location: <strong>{profile.lat}°N, {profile.lon}°E</strong> &nbsp;—&nbsp; Temperature progression across all 15 depth layers
            </p>
            <div style={{ height: 380 }}>
              <EChart option={profileOption} />
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-slate-light)' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🖱️</div>
            <p style={{ margin: 0 }}>
              Click any coordinate on the 2D heatmap above to generate a vertical thermal stratification sounding curve.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
