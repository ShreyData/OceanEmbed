import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getLastResult } from '../api/client';
import * as echarts from 'echarts';
import 'echarts-gl';
import { Tabs } from '../components/ui';
import {
  Layers,
  Box,
  Activity,
  Grid,
  Maximize2,
  Compass,
  RefreshCw,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Award,
  Sparkles,
  Info,
  Download,
  FileText,
} from 'lucide-react';

const DEPTH_LEVELS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
const THERMAL_COLORS = ['#000080', '#0000FF', '#00BFFF', '#00FFFF', '#7FFF00', '#FFFF00', '#FF8C00', '#FF0000', '#8B0000'];
const DIVERGING_DIFF_COLORS = ['#1e3a8a', '#2563eb', '#60a5fa', '#93c5fd', '#f1f5f9', '#fca5a5', '#f87171', '#dc2626', '#7f1d1d'];

// Preset ocean sounding stations with rich oceanographic data
const PRESET_STATIONS = [
  { name: 'Central Arabian Sea', lat: 15.0, lon: 68.0 },
  { name: 'Bay of Bengal Deep Basin', lat: 14.0, lon: 88.0 },
  { name: 'Equatorial Indian Ocean', lat: 6.0, lon: 75.0 },
  { name: 'Gulf of Oman Outflow', lat: 23.5, lon: 60.0 },
];

/**
 * High-performance, memory-safe ECharts wrapper for React 19.
 * Properly manages instance lifecycle, resize observer, and event handlers.
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

  // Update options safely
  useEffect(() => {
    if (chartRef.current && option) {
      try {
        chartRef.current.setOption(option, notMerge);
      } catch (err) {
        console.warn('ECharts setOption error:', err);
      }
    }
  }, [option, notMerge]);

  // Update dynamic event handlers
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onEvents) return;

    Object.entries(onEvents).forEach(([eventName, handler]) => {
      chart.off(eventName);
      chart.on(eventName, handler);
    });
  }, [onEvents]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />;
}

function StatCard({ label, value, unit = '', color, subtitle = null }) {
  return (
    <div style={{
      background: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      padding: '14px 18px',
      flex: 1,
      minWidth: 140,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: color || 'var(--color-ocean-abyss)' }}>
        {value}<span style={{ fontSize: '0.8rem', fontWeight: 500, marginLeft: 4, color: 'var(--color-slate-light)' }}>{unit}</span>
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.72rem', color: 'var(--color-slate-light)', marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

/**
 * Generates an executive oceanographic analysis report of the model's reconstructed 3D volume.
 * Strictly excludes benchmark / ground truth data, focusing purely on physical parameters:
 * layer-by-layer stratification, MLD estimate, thermocline gradient, and sub-basin sectors.
 */
function generateOceanAnalysisReport(data) {
  if (!data || !data.predictions) {
    alert('No reconstruction data available to generate report.');
    return;
  }
  const preds = data.predictions;
  const depths = data.depth_levels || DEPTH_LEVELS;
  const targetDate = data.target_date || 'Day 11 Target Field';

  // Calculate layer-by-layer statistics across all 15 depths
  const layerStats = depths.map((d, idx) => {
    const key = `${d}m`;
    const matrix = preds[key] || [];
    let min = Infinity, max = -Infinity, sum = 0, count = 0;
    const vals = [];
    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        if (val !== null && val !== undefined && !Number.isNaN(val)) {
          if (val < min) min = val;
          if (val > max) max = val;
          sum += val;
          count++;
          vals.push(val);
        }
      }
    }
    const mean = count > 0 ? sum / count : null;
    let variance = 0;
    if (count > 1 && mean !== null) {
      for (let i = 0; i < vals.length; i++) {
        variance += Math.pow(vals[i] - mean, 2);
      }
      variance = variance / count;
    }
    const std = count > 1 ? Math.sqrt(variance) : 0;
    return {
      depth: d,
      min: min !== Infinity ? Math.round(min * 100) / 100 : null,
      max: max !== -Infinity ? Math.round(max * 100) / 100 : null,
      mean: mean !== null ? Math.round(mean * 100) / 100 : null,
      std: Math.round(std * 100) / 100,
      oceanPixels: count,
    };
  });

  // Calculate vertical thermal gradient (dT/dz) in °C per 100m
  for (let i = 0; i < layerStats.length; i++) {
    if (i === 0) {
      layerStats[i].gradient = 0;
    } else {
      const dz = layerStats[i].depth - layerStats[i - 1].depth;
      const dt = (layerStats[i].mean !== null && layerStats[i - 1].mean !== null)
        ? layerStats[i].mean - layerStats[i - 1].mean
        : 0;
      layerStats[i].gradient = dz > 0 ? Math.round((dt / dz) * 1000) / 10 : 0;
    }
  }

  // Regional sub-basin averages (Lat: 5.0 + r*0.25, Lon: 45.0 + c*0.25)
  const computeSectorMean = (depthKey, minLat, maxLat, minLon, maxLon) => {
    const matrix = preds[depthKey] || [];
    let sum = 0, count = 0;
    for (let r = 0; r < matrix.length; r++) {
      const lat = 5.0 + r * 0.25;
      if (lat < minLat || lat > maxLat) continue;
      const row = matrix[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const lon = 45.0 + c * 0.25;
        if (lon < minLon || lon > maxLon) continue;
        const val = row[c];
        if (val !== null && val !== undefined && !Number.isNaN(val)) {
          sum += val;
          count++;
        }
      }
    }
    return count > 0 ? (sum / count).toFixed(2) : 'N/A';
  };

  const arabianSeaSurface = computeSectorMean('0m', 10, 26, 50, 76);
  const arabianSea100m = computeSectorMean('100m', 10, 26, 50, 76);
  const arabianSea500m = computeSectorMean('500m', 10, 26, 50, 76);

  const bobSurface = computeSectorMean('0m', 10, 22, 80, 98);
  const bob100m = computeSectorMean('100m', 10, 22, 80, 98);
  const bob500m = computeSectorMean('500m', 10, 22, 80, 98);

  const eqSurface = computeSectorMean('0m', 5, 10, 55, 95);
  const eq100m = computeSectorMean('100m', 5, 10, 55, 95);
  const eq500m = computeSectorMean('500m', 5, 10, 55, 95);

  const surfaceMean = layerStats[0]?.mean !== null ? layerStats[0].mean : 'N/A';
  const deepMean = layerStats[layerStats.length - 1]?.mean !== null ? layerStats[layerStats.length - 1].mean : 'N/A';

  // Find depth of maximum vertical temperature gradient (Thermocline core)
  let maxGrad = { depth: 100, gradient: 0 };
  layerStats.forEach(s => {
    if (Math.abs(s.gradient) > Math.abs(maxGrad.gradient)) maxGrad = s;
  });

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OceanEmbed Subsurface Thermal Reconstruction Report - ${targetDate}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 36px 40px; color: #1e293b; background: #ffffff; line-height: 1.5; font-size: 13px; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 22px; font-weight: 800; color: #0c4a6e; margin: 0; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 3px; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
    .meta-label { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 10px; }
    .meta-val { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    h2 { font-size: 15px; font-weight: 700; color: #0c4a6e; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 18px; }
    th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 600; color: #334155; border: 1px solid #e2e8f0; font-size: 11px; }
    td { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11.5px; }
    tr:nth-child(even) { background: #f8fafc; }
    .sector-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
    .sector-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
    .sector-name { font-weight: 700; font-size: 12.5px; color: #0284c7; margin-bottom: 4px; }
    .footer { font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 30px; }
    .btn-print { background: #0284c7; color: white; border: none; padding: 9px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
    @media print {
      body { margin: 10mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <h1 class="title">Oceanographic Subsurface Thermal Reconstruction Report</h1>
      <div class="subtitle">Physical Water Column Stratification & Thermal Gradient Analysis</div>
    </div>
    <div style="text-align: right; font-size: 11.5px; color: #64748b;">
      Date Generated: ${new Date().toISOString().split('T')[0]}<br/>
      Engine: <strong>OceanEmbed v2 Dual-Branch Architecture</strong>
    </div>
  </div>

  <div class="meta-grid">
    <div>
      <div class="meta-label">Observation Date</div>
      <div class="meta-val">${targetDate}</div>
    </div>
    <div>
      <div class="meta-label">Domain Bounds</div>
      <div class="meta-val">North Indian Ocean</div>
      <div style="font-size: 11px; color: #64748b;">5.0°N–29.75°N, 45.0°E–104.75°E</div>
    </div>
    <div>
      <div class="meta-label">Grid Dimensions</div>
      <div class="meta-val">100 × 240 (0.25°)</div>
      <div style="font-size: 11px; color: #64748b;">~27 km Horizontal Resolution</div>
    </div>
    <div>
      <div class="meta-label">Vertical Resolution</div>
      <div class="meta-val">15 Standard Depths</div>
      <div style="font-size: 11px; color: #64748b;">0m (Surface) to 1000m (Abyssal)</div>
    </div>
  </div>

  <h2>1. Thermal Stratification Diagnostics</h2>
  <p style="color: #475569; margin-bottom: 12px;">
    Basin-wide sea surface mixed layer temperature averages <strong>${surfaceMean}°C</strong> across ocean cells. The main thermocline experiences its steepest vertical gradient at <strong>${maxGrad.depth}m depth</strong> (${maxGrad.gradient}°C/100m). In the deep ocean below 500m, temperatures stabilize into cold water masses, reaching an average of <strong>${deepMean}°C</strong> at 1000m depth.
  </p>

  <h2>2. Regional Sub-Basin Thermal Characteristics</h2>
  <div class="sector-grid">
    <div class="sector-card">
      <div class="sector-name">Arabian Sea Sector</div>
      <div style="font-size: 10.5px; color: #64748b;">10°N–26°N, 50°E–76°E</div>
      <div style="margin-top: 6px; font-size: 11.5px; line-height: 1.6;">
        Surface (0m): <strong>${arabianSeaSurface}°C</strong><br/>
        Thermocline (100m): <strong>${arabianSea100m}°C</strong><br/>
        Deep Ocean (500m): <strong>${arabianSea500m}°C</strong>
      </div>
    </div>
    <div class="sector-card">
      <div class="sector-name">Bay of Bengal Sector</div>
      <div style="font-size: 10.5px; color: #64748b;">10°N–22°N, 80°E–98°E</div>
      <div style="margin-top: 6px; font-size: 11.5px; line-height: 1.6;">
        Surface (0m): <strong>${bobSurface}°C</strong><br/>
        Thermocline (100m): <strong>${bob100m}°C</strong><br/>
        Deep Ocean (500m): <strong>${bob500m}°C</strong>
      </div>
    </div>
    <div class="sector-card">
      <div class="sector-name">Equatorial Channel</div>
      <div style="font-size: 10.5px; color: #64748b;">5°N–10°N, 55°E–95°E</div>
      <div style="margin-top: 6px; font-size: 11.5px; line-height: 1.6;">
        Surface (0m): <strong>${eqSurface}°C</strong><br/>
        Thermocline (100m): <strong>${eq100m}°C</strong><br/>
        Deep Ocean (500m): <strong>${eq500m}°C</strong>
      </div>
    </div>
  </div>

  <h2>3. Water Column Layer-by-Layer Statistics (All 15 Depths)</h2>
  <table>
    <thead>
      <tr>
        <th>Depth (m)</th>
        <th>Stratification Zone</th>
        <th>Mean Temp (°C)</th>
        <th>Min Temp (°C)</th>
        <th>Max Temp (°C)</th>
        <th>Std Dev (°C)</th>
        <th>Vertical Gradient (dT/dz)</th>
        <th>Active Ocean Grid Cells</th>
      </tr>
    </thead>
    <tbody>
      ${layerStats.map(s => `
        <tr>
          <td><strong>${s.depth}m</strong></td>
          <td style="color: #64748b;">${s.depth <= 50 ? 'Surface Mixed Layer' : s.depth <= 200 ? 'Thermocline Core' : 'Deep Abyssal Plain'}</td>
          <td><strong>${s.mean !== null ? s.mean.toFixed(2) : '-'}°C</strong></td>
          <td>${s.min !== null ? s.min.toFixed(2) : '-'}°C</td>
          <td>${s.max !== null ? s.max.toFixed(2) : '-'}°C</td>
          <td>±${s.std.toFixed(2)}°C</td>
          <td style="color: ${s.gradient < -1.0 ? '#0284c7' : '#64748b'};">${s.gradient !== 0 ? `${s.gradient > 0 ? '+' : ''}${s.gradient}°C/100m` : 'Reference (0m)'}</td>
          <td>${s.oceanPixels.toLocaleString()}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    OceanEmbed Analysis Report · Synthesized from 11-day multi-sensor observation matrix · North Indian Ocean Domain · Smart India Hackathon 2026
  </div>
</body>
</html>`;

  const reportWindow = window.open('', '_blank');
  if (reportWindow) {
    reportWindow.document.write(htmlContent);
    reportWindow.document.close();
  } else {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OceanEmbed_Physical_Report_${targetDate}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Data hydration ────────────────────────────────────────────────────────
  // Source of truth: window.__OCEAN_RESULT__ (set by predictFromNC in client.js)
  // This approach is used because:
  //   - sessionStorage silently fails at 6.5 MB (5 MB quota limit)
  //   - React Router navigate state silently fails at 6.5 MB (History API ~640KB–2MB)
  //   - Module-level vars get wiped on Vite HMR module re-evaluation
  //   - window object: no size limits, global scope, survives SPA navigation
  const [data, setData] = useState(() => {
    return window.__OCEAN_RESULT__ || null;
  });

  // Safety net: if component mounts before window is set (race condition), re-check
  useEffect(() => {
    if (!data && window.__OCEAN_RESULT__) {
      setData(window.__OCEAN_RESULT__);
    }
  }, []);

  const [activeTab, setActiveTab] = useState('slice');
  const [activeDepthIdx, setActiveDepthIdx] = useState(0);
  const [viewMode2D, setViewMode2D] = useState('single'); // 'single' | 'all'
  
  // Benchmark state
  const [selectedFloatIdx, setSelectedFloatIdx] = useState(0);

  // 3D scatter controls
  const [latRange, setLatRange] = useState([5.0, 29.75]);
  const [lonRange, setLonRange] = useState([45.0, 104.75]);
  const [selectedDepths, setSelectedDepths] = useState(new Set(DEPTH_LEVELS));
  const [pointSize, setPointSize] = useState(3);

  // Sounding profile coordinates (default to Central Arabian Sea)
  const [profileLocation, setProfileLocation] = useState({ lat: 15.0, lon: 68.0 });

  // Note: No sessionStorage sync — 6.5 MB JSON exceeds quota. Module store handles persistence.

  if (!data || data.status !== 'success') {
    return (
      <div style={{ paddingTop: 80, textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🌊</div>
        <h2 style={{ color: 'var(--color-ocean-abyss)' }}>No Ocean Reconstruction Available</h2>
        <p style={{ color: 'var(--color-slate-light)', maxWidth: 440, margin: '8px auto 20px' }}>
          Upload an 11-day NetCDF observation matrix or load our sample to run neural inference.
        </p>
        <button
          onClick={() => navigate('/input')}
          className="btn btn-primary"
        >
          Go to Upload Data
        </button>
      </div>
    );
  }

  const {
    latency_ms = 0,
    summary = {},
    grid = {},
    predictions = {},
    has_ground_truth = false,
    ground_truth = null,
    evaluation_metrics = null,
    target_date = null,
  } = data;

  const lats = grid.lat || [];
  const lons = grid.lon || [];

  const tempMin = summary.deep_temp_min != null ? Math.floor(summary.deep_temp_min) : 0;
  const tempMax = summary.surface_temp_max != null ? Math.ceil(summary.surface_temp_max) : 32;

  /* ── 2D Heatmap Single-Depth Data Calculation ─────────────────────────── */
  const activeDepth = DEPTH_LEVELS[activeDepthIdx];
  const activeKey = `${activeDepth}m`;
  const currentLayerMatrix = predictions[activeKey] || [];

  // Compute precise min & max for THIS specific depth layer
  const { depthMin, depthMax, heatmapData } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    const pts = [];

    for (let r = 0; r < currentLayerMatrix.length; r++) {
      const row = currentLayerMatrix[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        if (val !== null && val !== undefined && !Number.isNaN(val)) {
          if (val < min) min = val;
          if (val > max) max = val;
          pts.push([c, r, val]);
        }
      }
    }

    return {
      depthMin: min !== Infinity ? Number(min.toFixed(2)) : 0,
      depthMax: max !== -Infinity ? Number(max.toFixed(2)) : 30,
      heatmapData: pts,
    };
  }, [currentLayerMatrix]);

  const layerMinVal = depthMin !== Infinity ? depthMin : 0;
  const layerMaxVal = depthMax !== -Infinity ? depthMax : 30;

  // On heatmap cell click handler -> updates sounding profile location
  const onHeatmapClick = useCallback((params) => {
    if (params.componentType !== 'series' || !params.data) return;
    const [lonIdx, latIdx] = params.data;
    const lat = lats[latIdx];
    const lon = lons[lonIdx];
    if (lat != null && lon != null) {
      setProfileLocation({ lat, lon });
    }
  }, [lats, lons]);

  /* ── 2D Heatmap Single Option (Layer-Specific Limits & Natural Land Color) ── */
  const heatmapOption = useMemo(() => ({
    backgroundColor: 'transparent',
    title: {
      text: `Ocean Subsurface Temperature at ${DEPTH_LEVELS[activeDepthIdx]}m Depth (Local Range: ${depthMin}°C – ${depthMax}°C)`,
      left: 'center',
      textStyle: { fontSize: 14, color: 'var(--color-ocean-abyss)', fontWeight: 600 }
    },
    tooltip: {
      formatter: (p) => {
        if (!p.data) return '';
        const lon = lons[p.data[0]];
        const lat = lats[p.data[1]];
        const temp = p.data[2];
        return `<b>Station:</b> ${lat?.toFixed(2)}°N, ${lon?.toFixed(2)}°E<br/><b>Temperature:</b> ${temp?.toFixed(2)}°C<br/><span style="color:#0284c7;font-size:11px;">Click to view vertical sounding profile</span>`;
      },
    },
    grid: {
      top: 50,
      bottom: 60,
      left: 65,
      right: 125,
      show: true,
      backgroundColor: '#c8bfae', // Natural earth/sand continent landmass color
      borderColor: '#cbd5e1',
      borderWidth: 1,
    },
    xAxis: {
      type: 'category',
      data: lons.map((v, i) => (i % 20 === 0 ? `${v.toFixed(1)}°E` : '')),
      name: 'Longitude',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { interval: 0, color: '#64748b' },
      axisLine: { lineStyle: { color: '#cbd5e1' } }
    },
    yAxis: {
      type: 'category',
      data: lats.map((v, i) => (i % 10 === 0 ? `${v.toFixed(1)}°N` : '')),
      name: 'Latitude',
      nameLocation: 'middle',
      nameGap: 45,
      axisLabel: { interval: 0, color: '#64748b' },
      axisLine: { lineStyle: { color: '#cbd5e1' } }
    },
    visualMap: {
      min: layerMinVal,
      max: layerMaxVal,
      calculable: true,
      orient: 'vertical',
      right: 12,
      top: 'middle',
      inRange: { color: THERMAL_COLORS },
      text: [`${layerMaxVal.toFixed(1)}°C`, `${layerMinVal.toFixed(1)}°C`],
      textStyle: { fontSize: 11, color: '#475569' },
    },
    series: [{
      type: 'heatmap',
      data: heatmapData,
      emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
      progressive: 2000,
      animation: false,
    }],
  }), [activeDepthIdx, lons, lats, layerMinVal, layerMaxVal, depthMin, depthMax, heatmapData]);

  /* ── 3D Scatter Data Calculation ────────────────────────────────────── */
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
    backgroundColor: '#071626',
    tooltip: {
      formatter: (p) => {
        if (!p.data) return '';
        const [lon, lat, depth, temp] = p.data;
        return `<b>Position:</b> ${lat}°N, ${lon}°E<br/><b>Depth:</b> ${Math.abs(depth)}m<br/><b>Temperature:</b> ${temp.toFixed(2)}°C`;
      },
    },
    visualMap: {
      min: tempMin,
      max: tempMax,
      dimension: 3,
      inRange: { color: THERMAL_COLORS },
      textStyle: { color: '#94a3b8', fontSize: 11 },
      orient: 'vertical',
      right: 12,
      top: 'middle',
    },
    xAxis3D: {
      type: 'value',
      name: 'Longitude (°E)',
      nameTextStyle: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#1e293b' } },
      splitLine: { lineStyle: { color: '#1e293b' } }
    },
    yAxis3D: {
      type: 'value',
      name: 'Latitude (°N)',
      nameTextStyle: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#1e293b' } },
      splitLine: { lineStyle: { color: '#1e293b' } }
    },
    zAxis3D: {
      type: 'value',
      name: 'Depth (m)',
      nameTextStyle: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { formatter: (v) => `${Math.abs(v)}m` },
      min: -1010,
      max: 0,
      splitLine: { lineStyle: { color: '#1e293b' } }
    },
    grid3D: {
      boxWidth: 200,
      boxDepth: 85,
      boxHeight: 80,
      viewControl: { autoRotate: false, distance: 240, alpha: 22, beta: 32 },
      light: {
        main: { intensity: 1.6, shadow: false },
        ambient: { intensity: 0.5 },
      },
    },
    series: [{
      type: 'scatter3D',
      data: scatter3dData,
      symbolSize: pointSize,
      itemStyle: { opacity: 0.85 },
      emphasis: { itemStyle: { opacity: 1, symbolSize: pointSize + 3 } },
    }],
  }), [tempMin, tempMax, scatter3dData, pointSize]);

  /* ── Vertical Profile Curve (ALWAYS PRE-LOADED AND COMPUTED) ─────────── */
  const { profilePoints, isOceanStation } = useMemo(() => {
    if (!lats.length || !lons.length) return { profilePoints: [], isOceanStation: false };
    
    let closestLatIdx = 0;
    let minLatDiff = Infinity;
    for (let i = 0; i < lats.length; i++) {
      const diff = Math.abs(lats[i] - profileLocation.lat);
      if (diff < minLatDiff) { minLatDiff = diff; closestLatIdx = i; }
    }

    let closestLonIdx = 0;
    let minLonDiff = Infinity;
    for (let j = 0; j < lons.length; j++) {
      const diff = Math.abs(lons[j] - profileLocation.lon);
      if (diff < minLonDiff) { minLonDiff = diff; closestLonIdx = j; }
    }

    const points = [];
    DEPTH_LEVELS.forEach((d) => {
      const key = `${d}m`;
      const gridMatrix = predictions[key];
      if (gridMatrix && gridMatrix[closestLatIdx]) {
        const val = gridMatrix[closestLatIdx][closestLonIdx];
        if (val !== null && val !== undefined && !Number.isNaN(val)) {
          points.push({ depth: d, temp: Number(Number(val).toFixed(2)) });
        }
      }
    });

    return { profilePoints: points, isOceanStation: points.length > 0 };
  }, [profileLocation, lats, lons, predictions]);

  const profileOption = useMemo(() => {
    if (profilePoints.length === 0) return null;

    const dataPairs = profilePoints.map(p => [p.temp, -p.depth]);

    return {
      title: {
        text: `CTD Sounding Curve at Lat ${profileLocation.lat.toFixed(2)}°N, Lon ${profileLocation.lon.toFixed(2)}°E`,
        left: 'center',
        textStyle: { fontSize: 14, color: 'var(--color-ocean-abyss)', fontWeight: 600 }
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const item = params[0];
          if (!item) return '';
          return `<b>Depth:</b> ${Math.abs(item.data[1])}m<br/><b>Temperature:</b> ${item.data[0]}°C`;
        }
      },
      grid: { top: 50, bottom: 55, left: 75, right: 35 },
      xAxis: {
        type: 'value',
        name: 'Temperature (°C)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLine: { lineStyle: { color: '#64748b' } },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      yAxis: {
        type: 'value',
        name: 'Depth (m)',
        nameLocation: 'middle',
        nameGap: 55,
        min: -1010,
        max: 5,
        axisLabel: { formatter: (v) => `${Math.abs(v)}m` },
        axisLine: { lineStyle: { color: '#64748b' } },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [{
        name: 'Ocean Temperature',
        type: 'line',
        smooth: true,
        data: dataPairs,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#0284c7', width: 3 },
        itemStyle: { color: '#0369a1', borderColor: '#ffffff', borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: 'rgba(2, 132, 199, 0.35)' },
            { offset: 1, color: 'rgba(2, 132, 199, 0.02)' },
          ]),
        },
      }],
    };
  }, [profilePoints, profileLocation]);

  /* ── BENCHMARK / COMPARISON COMPUTATIONS ──────────────────────────────── */
  const argoFloats = ground_truth?.argo_floats || [];
  const currentArgoFloat = argoFloats[selectedFloatIdx] || argoFloats[0] || null;

  // 3-Way Vertical CTD Sounding Curve (Model vs GLORYS vs ARGO Float)
  const threeWayProfileOption = useMemo(() => {
    if (!currentArgoFloat) return null;

    const modelPairs = (currentArgoFloat.model_profile || []).map(p => [p.temp, -p.depth]);
    const glorysPairs = (currentArgoFloat.glorys_profile || []).map(p => [p.temp, -p.depth]);
    const argoPairs = (currentArgoFloat.argo_profile || []).map(p => [p.temp, -p.depth]);

    return {
      title: {
        text: `3-Way CTD Sounding: Model vs GLORYS vs In-Situ ARGO (Float #${currentArgoFloat.float_id} at ${currentArgoFloat.lat}°N, ${currentArgoFloat.lon}°E)`,
        left: 'center',
        textStyle: { fontSize: 13, color: 'var(--color-ocean-abyss)', fontWeight: 700 }
      },
      legend: {
        data: ['OceanEmbed (Model)', 'CMEMS GLORYS12V1', 'INCOIS ARGO Float (In-Situ)'],
        top: 30,
        textStyle: { fontSize: 11, color: '#334155' },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          if (!params || !params.length) return '';
          const depth = Math.abs(params[0].data[1]);
          let html = `<b>Depth: ${depth}m</b><br/>`;
          params.forEach((p) => {
            html += `<span style="color:${p.color};font-weight:600;">● ${p.seriesName}:</span> ${p.data[0]}°C<br/>`;
          });
          return html;
        }
      },
      grid: { top: 75, bottom: 55, left: 75, right: 35 },
      xAxis: {
        type: 'value',
        name: 'Temperature (°C)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLine: { lineStyle: { color: '#64748b' } },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      yAxis: {
        type: 'value',
        name: 'Depth (m)',
        nameLocation: 'middle',
        nameGap: 55,
        min: -1010,
        max: 5,
        axisLabel: { formatter: (v) => `${Math.abs(v)}m` },
        axisLine: { lineStyle: { color: '#64748b' } },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          name: 'OceanEmbed (Model)',
          type: 'line',
          smooth: true,
          data: modelPairs,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: '#0284c7', width: 3 },
          itemStyle: { color: '#0284c7', borderColor: '#ffffff', borderWidth: 2 },
        },
        {
          name: 'CMEMS GLORYS12V1',
          type: 'line',
          smooth: true,
          data: glorysPairs,
          symbol: 'rect',
          symbolSize: 7,
          lineStyle: { color: '#10b981', width: 2, type: 'dashed' },
          itemStyle: { color: '#10b981', borderColor: '#ffffff', borderWidth: 2 },
        },
        {
          name: 'INCOIS ARGO Float (In-Situ)',
          type: 'line',
          smooth: false,
          data: argoPairs,
          symbol: 'diamond',
          symbolSize: 10,
          lineStyle: { color: '#f59e0b', width: 2, type: 'dotted' },
          itemStyle: { color: '#f59e0b', borderColor: '#ffffff', borderWidth: 2 },
        },
      ],
    };
  }, [currentArgoFloat]);



  // Depth-by-Depth RMSE Progression — ARGO as Ground Truth
  const depthProgressionOption = useMemo(() => {
    if (!evaluation_metrics?.layer_metrics) return null;
    const layerMetrics = evaluation_metrics.layer_metrics;
    // New keys: model_vs_argo_rmse and glorys_vs_argo_rmse (both referenced to ARGO truth)
    const modelArgoRmses  = DEPTH_LEVELS.map(d => layerMetrics[`${d}m`]?.model_vs_argo_rmse ?? null);
    const glorysArgoRmses = DEPTH_LEVELS.map(d => layerMetrics[`${d}m`]?.glorys_vs_argo_rmse ?? null);

    return {
      title: {
        text: 'RMSE vs ARGO In-Situ by Depth — OceanEmbed vs GLORYS12V1',
        left: 'center',
        textStyle: { fontSize: 13, color: 'var(--color-ocean-abyss)', fontWeight: 600 }
      },
      legend: {
        data: ['OceanEmbed Model vs ARGO (°C)', 'GLORYS12V1 vs ARGO (°C)'],
        top: 26,
        textStyle: { fontSize: 11, color: '#475569' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          let out = `<b>${params[0]?.axisValue}</b><br/>`;
          params.forEach(p => {
            if (p.value != null) out += `${p.marker} ${p.seriesName}: <b>${p.value}°C</b><br/>`;
          });
          return out;
        }
      },
      grid: { top: 65, bottom: 40, left: 60, right: 30 },
      xAxis: {
        type: 'category',
        data: DEPTH_LEVELS.map(d => `${d}m`),
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b' }
      },
      yAxis: {
        type: 'value',
        name: 'RMSE vs ARGO (°C)',
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        min: 0,
      },
      series: [
        {
          name: 'OceanEmbed Model vs ARGO (°C)',
          type: 'bar',
          data: modelArgoRmses,
          itemStyle: { color: '#0284c7', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'GLORYS12V1 vs ARGO (°C)',
          type: 'line',
          data: glorysArgoRmses,
          connectNulls: true,
          symbol: 'diamond',
          symbolSize: 8,
          lineStyle: { color: '#10b981', width: 2.5 },
          itemStyle: { color: '#10b981' },
        }
      ]
    };
  }, [evaluation_metrics]);


  /* ── 2D Tab Content ──────────────────────────────────────────────────── */
  const render2DTabContent = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Sub-Header: Single Depth vs All Layers Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setViewMode2D('single')}
              className={viewMode2D === 'single' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Layers size={16} /> Single Depth Analysis
            </button>
            <button
              onClick={() => setViewMode2D('all')}
              className={viewMode2D === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Grid size={16} /> All 15 Depth Layers (Matrix View)
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.8rem',
              color: 'var(--color-slate-charcoal)',
              background: '#ffffff',
              padding: '3px 10px',
              borderRadius: 6,
              border: '1px solid var(--color-border)'
            }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: '#c8bfae', border: '1px solid #a89f8e', display: 'inline-block' }}></span>
              <strong>Landmass</strong> (Continental Earth)
            </span>

            {viewMode2D === 'single' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.8rem',
                color: 'var(--color-ocean-deep)',
                background: 'var(--color-very-light-aqua)',
                padding: '3px 10px',
                borderRadius: 6,
                border: '1px solid var(--color-seafoam)'
              }}>
                🎯 Dynamic Layer Scale: <strong>{depthMin}°C to {depthMax}°C</strong>
              </span>
            )}
          </div>
        </div>

        {viewMode2D === 'single' ? (
          <>
            {/* Depth Selector Pills */}
            <div style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-slate-light)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Select Ocean Depth Level (0m – 1000m)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {DEPTH_LEVELS.map((d, i) => {
                  const isActive = i === activeDepthIdx;
                  return (
                    <button
                      key={d}
                      onClick={() => setActiveDepthIdx(i)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: isActive ? '1px solid var(--color-ocean-cyan)' : '1px solid var(--color-border)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: isActive ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#ffffff',
                        color: isActive ? '#ffffff' : 'var(--color-slate-charcoal)',
                        boxShadow: isActive ? '0 2px 6px rgba(2, 132, 199, 0.3)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {d}m
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2D Heatmap Box */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={18} color="var(--color-ocean-cyan)" />
                  2D Isothermal Depth Slice ({DEPTH_LEVELS[activeDepthIdx]}m)
                </h3>
                <span className="badge">100 × 240 Grid (0.25° Resolution)</span>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.825rem', color: 'var(--color-slate-light)' }}>
                Hover for exact coordinate readings. <strong>Click anywhere on the ocean</strong> to update the vertical CTD sounding profile.
              </p>
              <div style={{ height: 440 }}>
                <EChart option={heatmapOption} onEvents={{ click: onHeatmapClick }} />
              </div>
            </div>
          </>
        ) : (
          /* Multi-Depth 15-Layer Grid Matrix */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-slate-light)' }}>
              Comparing all 15 reconstructed vertical ocean layers simultaneously. Click on any layer to zoom into single-depth analysis.
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16
            }}>
              {DEPTH_LEVELS.map((depth, idx) => {
                const key = `${depth}m`;
                const matrix = predictions[key] || [];
                
                let min = Infinity, max = -Infinity;
                const miniData = [];
                for (let r = 0; r < matrix.length; r += 2) {
                  for (let c = 0; c < (matrix[r] || []).length; c += 2) {
                    const v = matrix[r][c];
                    if (v !== null && v !== undefined && !Number.isNaN(v)) {
                      if (v < min) min = v;
                      if (v > max) max = v;
                      miniData.push([c, r, v]);
                    }
                  }
                }

                const miniOption = {
                  animation: false,
                  grid: {
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    show: true,
                    backgroundColor: '#c8bfae',
                    borderColor: 'transparent',
                  },
                  xAxis: { type: 'category', show: false },
                  yAxis: { type: 'category', show: false },
                  visualMap: {
                    min: min !== Infinity ? min : 0,
                    max: max !== -Infinity ? max : 30,
                    show: false,
                    inRange: { color: THERMAL_COLORS }
                  },
                  series: [{
                    type: 'heatmap',
                    data: miniData,
                    progressive: 500,
                  }]
                };

                return (
                  <div
                    key={depth}
                    onClick={() => {
                      setActiveDepthIdx(idx);
                      setViewMode2D('single');
                    }}
                    style={{
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-ocean-cyan)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-ocean-deep)' }}>
                        {depth}m Layer
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)' }}>
                        {min !== Infinity ? `${min.toFixed(1)}°C` : '-'} to {max !== -Infinity ? `${max.toFixed(1)}°C` : '-'}
                      </span>
                    </div>
                    <div style={{ height: 110, borderRadius: 6, overflow: 'hidden', background: '#071626' }}>
                      <EChart option={miniOption} />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 6, fontSize: '0.72rem', color: 'var(--color-ocean-cyan)', fontWeight: 600 }}>
                      Inspect Depth →
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── 3D Volume Tab Content ───────────────────────────────────────────── */
  const render3DTabContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 3D Filter Control Panel */}
      <div className="card" style={{ padding: 18, background: 'var(--color-card)' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-ocean-abyss)', marginBottom: 12 }}>
          Interactive Volume Filters & Spatiotemporal Subsetting
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 16,
          padding: 16,
          background: 'var(--color-ocean-mist)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-seafoam)'
        }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
              Latitude Bounds: {latRange[0].toFixed(1)}°N – {latRange[1].toFixed(1)}°N
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
            <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
              Longitude Bounds: {lonRange[0].toFixed(1)}°E – {lonRange[1].toFixed(1)}°E
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
            <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
              Depth Layers ({selectedDepths.size} of 15 enabled)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {DEPTH_LEVELS.map(d => {
                const isSelected = selectedDepths.has(d);
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDepths(prev => {
                      const next = new Set(prev);
                      next.has(d) ? next.delete(d) : next.add(d);
                      return next;
                    })}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: isSelected ? 'var(--color-ocean-cyan)' : '#e2e8f0',
                      color: isSelected ? '#ffffff' : '#64748b',
                    }}
                  >
                    {d}m
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
              Voxel Resolution: {pointSize}px
            </label>
            <input
              type="range" min={1} max={8} step={1} value={pointSize}
              onChange={e => setPointSize(+e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* 3D WebGL Chart */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ height: 520, borderRadius: 10, overflow: 'hidden', background: '#071626' }}>
          <EChart option={scatter3dOption} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          fontSize: '0.8rem',
          color: 'var(--color-slate-light)'
        }}>
          <span>🔄 Drag to rotate view in 3D space</span>
          <span>🔍 Scroll or pinch to zoom in/out</span>
          <span>🎨 Thermal gradient: Cold deep water (navy) to warm surface (red)</span>
        </div>
      </div>
    </div>
  );

  /* ── Vertical CTD Sounding Profile Tab Content ────────────────────────── */
  const renderProfileTabContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Coordinate & Station Selector */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-ocean-abyss)', marginBottom: 12 }}>
          Station Coordinates & Preset Ocean Sounding Sites
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-slate-light)', alignSelf: 'center', marginRight: 4 }}>
            Jump to Station:
          </span>
          {PRESET_STATIONS.map((station) => (
            <button
              key={station.name}
              onClick={() => setProfileLocation({ lat: station.lat, lon: station.lon })}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <Compass size={14} /> {station.name} ({station.lat}°N, {station.lon}°E)
            </button>
          ))}
        </div>

        {/* Manual coordinate sliders */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          padding: 16,
          background: 'var(--color-ocean-mist)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-seafoam)'
        }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
              Latitude: <strong>{profileLocation.lat.toFixed(2)}°N</strong> (Range: 5.0°N to 29.75°N)
            </label>
            <input
              type="range" min={5.0} max={29.75} step={0.25} value={profileLocation.lat}
              onChange={e => setProfileLocation(prev => ({ ...prev, lat: +e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
              Longitude: <strong>{profileLocation.lon.toFixed(2)}°E</strong> (Range: 45.0°E to 104.75°E)
            </label>
            <input
              type="range" min={45.0} max={104.75} step={0.25} value={profileLocation.lon}
              onChange={e => setProfileLocation(prev => ({ ...prev, lon: +e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Sounding Chart Box */}
      <div className="card" style={{ padding: 20 }}>
        {isOceanStation ? (
          <>
            <div style={{ height: 420 }}>
              <EChart option={profileOption} />
            </div>

            {/* Oceanographic Stratification Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--color-border)'
            }}>
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--color-slate-light)' }}>Surface Mixed Layer (0m): </span>
                <strong>{profilePoints[0]?.temp != null ? `${profilePoints[0].temp}°C` : '-'}</strong>
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--color-slate-light)' }}>Thermocline Core (150m): </span>
                <strong>{profilePoints.find(p => p.depth === 150)?.temp != null ? `${profilePoints.find(p => p.depth === 150).temp}°C` : '-'}</strong>
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--color-slate-light)' }}>Abyssal Floor (1000m): </span>
                <strong>{profilePoints[profilePoints.length - 1]?.temp != null ? `${profilePoints[profilePoints.length - 1].temp}°C` : '-'}</strong>
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--color-slate-light)' }}>Thermal Gradient ΔT: </span>
                <strong>
                  {profilePoints.length >= 2
                    ? `${(profilePoints[0].temp - profilePoints[profilePoints.length - 1].temp).toFixed(1)}°C`
                    : '-'}
                </strong>
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--color-slate-light)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏝️</div>
            <h4 style={{ color: 'var(--color-ocean-abyss)', marginBottom: 6 }}>Land Coordinates Selected</h4>
            <p style={{ maxWidth: 440, margin: '0 auto 16px', fontSize: '0.875rem' }}>
              The location ({profileLocation.lat.toFixed(2)}°N, {profileLocation.lon.toFixed(2)}°E) falls on continental landmass where ocean subsurface data is masked.
            </p>
            <button
              onClick={() => setProfileLocation({ lat: 15.0, lon: 68.0 })}
              className="btn btn-secondary"
            >
              Reset to Central Arabian Sea (Deep Water)
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ── BENCHMARK TAB CONTENT (Model vs GLORYS vs ARGO Ground Truth) ───── */
  const renderBenchmarkTabContent = () => {
    if (!has_ground_truth || !evaluation_metrics) {
      return (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔬</div>
          <h3 style={{ color: 'var(--color-ocean-abyss)', marginBottom: 8 }}>
            Ground Truth Benchmark Unavailable for Custom Upload
          </h3>
          <p style={{ color: 'var(--color-slate-light)', maxWidth: 520, margin: '0 auto 20px', fontSize: '0.9rem' }}>
            Multi-source comparison against <strong>CMEMS GLORYS12V1 3D Reanalysis</strong> and <strong>INCOIS ARGO Float Soundings</strong> is pre-indexed for our 10 curated demo datasets (covering all seasons 2022–2024).
          </p>
          <div style={{ display: 'inline-block', background: 'var(--color-ocean-mist)', padding: '10px 18px', borderRadius: 8, border: '1px solid var(--color-seafoam)', marginBottom: 20 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-ocean-deep)', fontWeight: 600 }}>
              💡 Notice: Comparison only available on demo inputs
            </span>
          </div>
          <div>
            <button onClick={() => navigate('/input')} className="btn btn-primary">
              Select Curated Demo Dataset
            </button>
          </div>
        </div>
      );
    }

    const m = evaluation_metrics;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* ── Benchmark Overview Banner ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(13, 148, 136, 0.12) 100%)',
          border: '1.5px solid var(--color-seafoam)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Award size={22} color="var(--color-ocean-cyan)" />
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-ocean-abyss)', fontWeight: 700 }}>
                Triple Benchmark: Model vs GLORYS12V1 vs INCOIS ARGO
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-slate-light)' }}>
              Target Evaluation Date: <strong>{m.target_date}</strong> · Season: <strong>{m.season}</strong>
            </p>
          </div>

          <span style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: 6,
            background: '#e0f2fe',
            color: '#0284c7',
            border: '1px solid #bae6fd',
          }}>
            Collocated Same-Day Validation
          </span>
        </div>

        {/* ── Scientific Accuracy Scorecard: ARGO as Ground Truth ── */}

        {/* ARGO vs GLORYS vs Model — 2-column comparison block */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* MODEL vs ARGO */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(2,132,199,0.08) 0%, rgba(6,182,212,0.06) 100%)',
            border: '2px solid var(--color-seafoam)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <strong style={{ fontSize: '0.95rem', color: 'var(--color-ocean-abyss)' }}>OceanEmbed Model vs ARGO</strong>
              <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 4, fontWeight: 700, border: '1px solid #93c5fd' }}>Our Prediction</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '12px 8px', border: '1px solid #e0f2fe' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-ocean-deep)' }}>
                  {m.model_vs_argo_rmse != null ? `${m.model_vs_argo_rmse}` : '-'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>RMSE (°C)</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>vs ARGO truth</div>
              </div>
              <div style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '12px 8px', border: '1px solid #e0f2fe' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-ocean-deep)' }}>
                  {m.model_vs_argo_mae != null ? `${m.model_vs_argo_mae}` : '-'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>MAE (°C)</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Mean Abs Error</div>
              </div>
              <div style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '12px 8px', border: '1px solid #e0f2fe' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: (m.model_vs_argo_bias || 0) < 0 ? '#0369a1' : '#dc2626' }}>
                  {m.model_vs_argo_bias != null ? `${m.model_vs_argo_bias > 0 ? '+' : ''}${m.model_vs_argo_bias}` : '-'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Bias (°C)</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Systematic offset</div>
              </div>
            </div>
          </div>

          {/* GLORYS vs ARGO */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(13,148,136,0.06) 100%)',
            border: '2px solid #6ee7b7',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>🌊</span>
              <strong style={{ fontSize: '0.95rem', color: 'var(--color-ocean-abyss)' }}>GLORYS12V1 vs ARGO</strong>
              <span style={{ fontSize: '0.72rem', background: '#d1fae5', color: '#064e3b', padding: '2px 8px', borderRadius: 4, fontWeight: 700, border: '1px solid #6ee7b7' }}>Baseline</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '12px 8px', border: '1px solid #d1fae5' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46' }}>
                  {m.glorys_vs_argo_rmse != null ? `${m.glorys_vs_argo_rmse}` : '-'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>RMSE (°C)</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>vs ARGO truth</div>
              </div>
              <div style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '12px 8px', border: '1px solid #d1fae5' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46' }}>
                  {m.glorys_vs_argo_mae != null ? `${m.glorys_vs_argo_mae}` : '-'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>MAE (°C)</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Mean Abs Error</div>
              </div>
              <div style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '12px 8px', border: '1px solid #d1fae5' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: (m.glorys_vs_argo_bias || 0) < 0 ? '#0369a1' : '#dc2626' }}>
                  {m.glorys_vs_argo_bias != null ? `${m.glorys_vs_argo_bias > 0 ? '+' : ''}${m.glorys_vs_argo_bias}` : '-'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Bias (°C)</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Systematic offset</div>
              </div>
            </div>
          </div>
        </div>

        {/* Winner Banner */}
        {m.model_vs_argo_rmse != null && m.glorys_vs_argo_rmse != null && (() => {
          const modelWins = m.model_vs_argo_rmse < m.glorys_vs_argo_rmse;
          const diff = Math.abs(m.glorys_vs_argo_rmse - m.model_vs_argo_rmse).toFixed(3);
          return (
            <div style={{
              background: modelWins
                ? 'linear-gradient(90deg, #1e40af 0%, #0369a1 100%)'
                : 'linear-gradient(90deg, #065f46 0%, #0d9488 100%)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              color: '#fff',
            }}>
              <span style={{ fontSize: 26 }}>{modelWins ? '🏆' : '📊'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                  {modelWins
                    ? `OceanEmbed outperforms GLORYS by ${diff}°C RMSE against ARGO in-situ truth`
                    : `GLORYS outperforms OceanEmbed by ${diff}°C RMSE against ARGO in-situ truth`}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: 2 }}>
                  Evaluated at {m.argo_float_count} ARGO float stations · {m.argo_sounding_points} collocated in-situ observations
                  · Basin-wide GLORYS Agreement (Model vs GLORYS RMSE): {m.model_vs_glorys_rmse}°C
                </div>
              </div>
            </div>
          );
        })()}

        {/* Also show model vs GLORYS spatial stats as secondary card row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard
            label="Model vs GLORYS RMSE"
            value={m.model_vs_glorys_rmse != null ? m.model_vs_glorys_rmse.toFixed(3) : '-'}
            unit="°C"
            color="var(--color-ocean-cyan)"
            subtitle="Basin-wide spatial field error"
          />
          <StatCard
            label="Model vs GLORYS MAE"
            value={m.model_vs_glorys_mae != null ? m.model_vs_glorys_mae.toFixed(3) : '-'}
            unit="°C"
            color="#0d9488"
            subtitle="Mean Absolute Error"
          />
          <StatCard
            label="Model vs GLORYS R²"
            value={m.model_vs_glorys_r2 != null ? `${(m.model_vs_glorys_r2 * 100).toFixed(1)}%` : '-'}
            color="#10b981"
            subtitle="Spatial Variance Explained"
          />
          <StatCard
            label="Model Mean Bias"
            value={m.model_vs_glorys_bias != null ? `${m.model_vs_glorys_bias > 0 ? '+' : ''}${m.model_vs_glorys_bias.toFixed(3)}` : '-'}
            unit="°C"
            color={Math.abs(m.model_vs_glorys_bias || 0) < 0.1 ? '#10b981' : '#f59e0b'}
            subtitle="vs GLORYS global offset"
          />
        </div>

        {/* ── ARGO Handling Scientific Callout ── */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <Info size={20} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.84rem', color: '#92400e', lineHeight: 1.5 }}>
            <strong>Scientific Rigour — How ARGO Comparison Works:</strong> ARGO floats collect sparse, in-situ CTD vertical profiles — not a continuous 0.25° field. We <strong>collocate</strong> the model prediction and GLORYS reanalysis to each float's exact physical location (nearest-neighbour grid matching, ≤0.125° error). <strong>ARGO = source of truth</strong>. Both Model and GLORYS are compared against ARGO readings at those locations only — no interpolation, no artificial full-basin ARGO map.
          </div>
        </div>


        {/* ── SECTION 1: 3-Way Vertical CTD Sounding Profile ── */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Activity size={18} color="var(--color-ocean-cyan)" />
                3-Way Vertical Sounding Curve: Model vs GLORYS vs In-Situ ARGO Float
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--color-slate-light)' }}>
                Compare vertical stratification directly against physical CTD measurements gathered by autonomous underwater floats.
              </p>
            </div>
            <span className="badge" style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}>
              In-Situ Float Ground Truth
            </span>
          </div>

          {/* ARGO Float Station Selector Buttons */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-slate-light)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Select Active ARGO Float Station ({argoFloats.length} Floats active on {m.target_date}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {argoFloats.map((f, i) => {
                const isActive = i === selectedFloatIdx;
                const obsCount = (f.argo_profile || []).length;
                return (
                  <button
                    key={f.float_id || i}
                    onClick={() => setSelectedFloatIdx(i)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: isActive ? '1px solid #f59e0b' : '1px solid var(--color-border)',
                      background: isActive ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#ffffff',
                      color: isActive ? '#ffffff' : 'var(--color-slate-charcoal)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: isActive ? '0 2px 8px rgba(245, 158, 11, 0.35)' : 'var(--shadow-sm)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <MapPin size={14} />
                    <span>Float #{f.float_id} ({f.lat.toFixed(2)}°N, {f.lon.toFixed(2)}°E)</span>
                    <span style={{
                      fontSize: '0.7rem',
                      background: isActive ? 'rgba(0,0,0,0.18)' : '#f1f5f9',
                      padding: '1px 6px',
                      borderRadius: 4,
                      color: isActive ? '#fff' : '#64748b',
                    }}>
                      {obsCount} depths
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3-Way EChart Curve */}
          <div style={{ height: 420 }}>
            {threeWayProfileOption ? (
              <EChart option={threeWayProfileOption} />
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-slate-light)' }}>
                No active ARGO float sounding available for this selection.
              </div>
            )}
          </div>

          {/* Sounding Depth Breakdown Table for Selected Float */}
          {currentArgoFloat && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-ocean-abyss)', marginBottom: 10 }}>
                Numerical Sounding Comparison at Float #{currentArgoFloat.float_id} ({currentArgoFloat.lat}°N, {currentArgoFloat.lon}°E):
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-ocean-mist)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px', color: 'var(--color-ocean-abyss)' }}>Depth (m)</th>
                      <th style={{ padding: '8px 12px', color: '#b45309' }}>ARGO In-Situ (°C)</th>
                      <th style={{ padding: '8px 12px', color: '#0284c7' }}>OceanEmbed Model (°C)</th>
                      <th style={{ padding: '8px 12px', color: '#059669' }}>GLORYS12V1 (°C)</th>
                      <th style={{ padding: '8px 12px', color: 'var(--color-ocean-abyss)' }}>Model Error ΔT</th>
                      <th style={{ padding: '8px 12px', color: 'var(--color-ocean-abyss)' }}>GLORYS Error ΔT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEPTH_LEVELS.map((d) => {
                      const aItem = (currentArgoFloat.argo_profile || []).find(x => x.depth === d);
                      const mItem = (currentArgoFloat.model_profile || []).find(x => x.depth === d);
                      const gItem = (currentArgoFloat.glorys_profile || []).find(x => x.depth === d);

                      const aTemp = aItem ? aItem.temp : null;
                      const mTemp = mItem ? mItem.temp : null;
                      const gTemp = gItem ? gItem.temp : null;

                      const mErr = aTemp != null && mTemp != null ? Number((mTemp - aTemp).toFixed(2)) : null;
                      const gErr = aTemp != null && gTemp != null ? Number((gTemp - aTemp).toFixed(2)) : null;

                      return (
                        <tr key={d} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{d}m</td>
                          <td style={{ padding: '8px 12px', color: aTemp != null ? '#b45309' : '#94a3b8', fontWeight: aTemp != null ? 600 : 400 }}>
                            {aTemp != null ? `${aTemp}°C` : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#0284c7', fontWeight: 600 }}>
                            {mTemp != null ? `${mTemp}°C` : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#059669' }}>
                            {gTemp != null ? `${gTemp}°C` : '—'}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {mErr != null ? (
                              <span style={{ color: Math.abs(mErr) < 0.4 ? '#10b981' : Math.abs(mErr) < 0.8 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                                {mErr > 0 ? `+${mErr}` : mErr}°C
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {gErr != null ? (
                              <span style={{ color: Math.abs(gErr) < 0.4 ? '#10b981' : Math.abs(gErr) < 0.8 ? '#f59e0b' : '#ef4444' }}>
                                {gErr > 0 ? `+${gErr}` : gErr}°C
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>


        {/* ── SECTION 3: Depth-by-Depth Error Progression Chart ── */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <TrendingUp size={18} color="var(--color-ocean-cyan)" />
                Vertical Error Distribution (0m to 1000m)
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--color-slate-light)' }}>
                Evaluates error progression across surface mixed layer (0–50m), thermocline zone (75–200m), and abyssal plain (500–1000m).
              </p>
            </div>
            <span className="badge">15 Layers</span>
          </div>

          <div style={{ height: 320 }}>
            {depthProgressionOption && <EChart option={depthProgressionOption} />}
          </div>
        </div>

      </div>
    );
  };

  /* ── Tab Configuration ─────────────────────────────────────────────────── */
  const resultTabs = [
    {
      id: 'slice',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Layers size={16} /> 2D Depth Slice & Multi-Grid
        </span>
      ),
      content: render2DTabContent(),
    },
    {
      id: 'slice3d',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Box size={16} /> 3D Ocean Volume (ECharts GL)
        </span>
      ),
      content: render3DTabContent(),
    },
    {
      id: 'profile',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Activity size={16} /> Vertical CTD Sounding Curve
        </span>
      ),
      content: renderProfileTabContent(),
    },
    {
      id: 'benchmark',
      label: (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 700,
          color: has_ground_truth ? 'var(--color-ocean-cyan)' : 'inherit',
        }}>
          <GitCompare size={16} /> 🔬 Benchmark: Model vs GLORYS & ARGO
        </span>
      ),
      content: renderBenchmarkTabContent(),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Top Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0c4a6e', fontWeight: 800 }}>
              Oceanographic Reconstruction Dashboard
            </h1>
            <span className="badge" style={{ background: '#e0f2fe', color: '#0284c7', borderColor: '#bae6fd' }}>
              15 Depth Layers · 0m to 1000m
            </span>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            Volumetric subsurface thermal structure synthesized from 11-day multi-sensor surface observations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => generateOceanAnalysisReport(data)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              color: '#0284c7',
              border: '1.5px solid #bae6fd',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f9ff';
              e.currentTarget.style.borderColor = '#0284c7';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#bae6fd';
            }}
          >
            <Download size={16} color="#0284c7" />
            <span>Download Oceanographic Report</span>
          </button>

          <button
            onClick={() => navigate('/input')}
            className="btn btn-primary"
            style={{ padding: '9px 18px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} /> New Prediction
          </button>
        </div>
      </div>

      {/* ── BIG HIGHLIGHTED BUTTON: Compare Output with GLORYS & ARGO Data ── */}
      <div style={{
        background: has_ground_truth
          ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.1) 0%, rgba(13, 148, 136, 0.15) 100%)'
          : 'var(--color-card)',
        border: has_ground_truth ? '2px solid #0284c7' : '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 22px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: has_ground_truth ? '0 4px 20px rgba(2, 132, 199, 0.18)' : 'none',
        flexWrap: 'wrap',
        gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: has_ground_truth ? 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: 22,
            boxShadow: has_ground_truth ? '0 3px 12px rgba(2, 132, 199, 0.35)' : 'none',
          }}>
            🔬
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-ocean-abyss)', fontWeight: 700 }}>
                Compare Output with GLORYS and ARGO Data
              </h3>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 4,
                background: has_ground_truth ? '#e0f2fe' : '#f1f5f9',
                color: has_ground_truth ? '#0284c7' : '#64748b',
                border: `1px solid ${has_ground_truth ? '#bae6fd' : '#cbd5e1'}`,
              }}>
                {has_ground_truth ? `Target Date: ${target_date}` : 'Custom Upload'}
              </span>
            </div>
            <div style={{ fontSize: '0.84rem', color: has_ground_truth ? 'var(--color-ocean-deep)' : 'var(--color-slate-light)', marginTop: 4 }}>
              {has_ground_truth
                ? `Collocated comparison against CMEMS GLORYS12V1 3D reanalysis and ${evaluation_metrics?.argo_float_count || 0} discrete INCOIS ARGO CTD sounding floats.`
                : '⚠️ Comparison only available on demo inputs (requires collocated reanalysis and in-situ ARGO observation soundings).'}
            </div>
          </div>
        </div>

        {/* The Clickable Button */}
        <button
          onClick={() => setActiveTab('benchmark')}
          disabled={!has_ground_truth}
          style={{
            background: has_ground_truth
              ? 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)'
              : '#e2e8f0',
            color: has_ground_truth ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '12px 22px',
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: has_ground_truth ? 'pointer' : 'not-allowed',
            boxShadow: has_ground_truth ? '0 4px 14px rgba(13, 148, 136, 0.35)' : 'none',
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span>🔬 Compare Output with GLORYS & ARGO Data</span>
          </div>
          <span style={{
            fontSize: '0.68rem',
            background: has_ground_truth ? 'rgba(255,255,255,0.22)' : 'transparent',
            padding: '1px 6px',
            borderRadius: 3,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}>
            Comparison only available on demo inputs
          </span>
        </button>
      </div>

      {/* ── Inference Benchmark Banner ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Inference Latency" value={`~${Number(latency_ms).toFixed(0)}`} unit="ms" color="var(--color-ocean-cyan)" />
        <StatCard label="Model Checkpoint" value="9.87" unit="MB" />
        <StatCard label="Vertical Depths" value="15" unit="layers (0–1000m)" />
        <StatCard label="Grid Resolution" value="100×240" unit="0.25°" />
        <StatCard label="Surface Warmest" value={summary.surface_temp_max != null ? summary.surface_temp_max.toFixed(1) : '-'} unit="°C" color="#ef4444" />
        <StatCard label="Abyssal Floor Min" value={summary.deep_temp_min != null ? summary.deep_temp_min.toFixed(1) : '-'} unit="°C" color="#0284c7" />
      </div>

      {/* ── Tabbed Workspace ── */}
      <div style={{ width: '100%' }}>
        <Tabs
          tabs={resultTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

    </div>
  );
}
