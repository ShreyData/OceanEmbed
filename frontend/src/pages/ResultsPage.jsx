import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, Badge, Button, Tabs, EmptyState } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import Visualizer2D from '../components/Visualizer2D';
import VisualizerProfile from '../components/VisualizerProfile';

const ResultsPage = () => {
  const navigate = useNavigate();
  const [dataState, setDataState] = useState(null);

  useEffect(() => {
    // Read the result handed off from /input
    const result = window.__PREDICTION_RESULT__;
    if (result && result.status === 'success') {
      setDataState(result);
    }
  }, []);

  if (!dataState) {
    return (
      <div style={{ paddingTop: '100px' }}>
        <EmptyState 
          title="No Results Available" 
          description="Run a prediction from the Input page to view results." 
        />
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Button onClick={() => navigate('/input')}>Go to Input</Button>
        </div>
      </div>
    );
  }

  const { metadata, slices } = dataState;

  const resultTabs = [
    { 
      id: 'slice', 
      label: '2D Depth Slice', 
      content: <Visualizer2D dataState={dataState} errorMsg="" />
    },
    { 
      id: 'profile', 
      label: 'Vertical Profile', 
      content: <VisualizerProfile dataState={dataState} />
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Analysis Results</h1>
          <p className="text-slate-light">Subsurface temperature reconstruction complete.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="outline" onClick={() => window.print()}>Export Report</Button>
          <Button variant="primary" onClick={() => navigate('/input')}>New Prediction</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
        <Card style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)' }}>Data Type</div>
          <div style={{ marginTop: '4px' }}>
            {metadata.model_status ? (
              <Badge variant="primary">Predicted Data</Badge>
            ) : (
              <Badge variant="neutral">Historical Data</Badge>
            )}
          </div>
        </Card>
        <Card style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)' }}>Target Date</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{metadata.target_date || metadata.date}</div>
        </Card>
        <Card style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)' }}>Grid Shape</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{metadata.shape ? metadata.shape.join(' × ') : 'N/A'}</div>
        </Card>
        <Card style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)' }}>Depth Levels</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{slices.length}</div>
        </Card>
        <Card style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)' }}>Inference Time</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{metadata.total_inference_ms ? `${metadata.total_inference_ms}ms` : 'N/A'}</div>
        </Card>
        <Card style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)' }}>Status</div>
          <div style={{ marginTop: '4px' }}>
            <Badge variant="primary">{metadata.model_status || 'Success'}</Badge>
          </div>
        </Card>
      </div>

      <div style={{ width: '100%' }}>
        <Tabs 
          tabs={resultTabs}
          activeTab="slice"
          onTabChange={() => {}}
        />
      </div>
    </div>
  );
};

export default ResultsPage;
