import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, Button, LoadingState, ErrorState, Badge } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { fetchPredictionData } from '../api/client';
import { Upload } from 'lucide-react';

const DEFAULT_JSON = `{
  "target_date": "2024-06-15",
  "surface_observations": {
    "sst_c": [[]],
    "sss_psu": [[]],
    "sla_m": [[]],
    "u_current_ms": [[]],
    "v_current_ms": [[]],
    "u_wind_ms": [[]],
    "v_wind_ms": [[]]
  }
}`;

const InputPage = () => {
  const navigate = useNavigate();
  const [jsonInput, setJsonInput] = useState(DEFAULT_JSON);
  const [status, setStatus] = useState('idle'); // idle, validating, loading, error
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        // Verify it's valid JSON before setting
        const parsed = JSON.parse(text);
        setJsonInput(JSON.stringify(parsed, null, 2));
        setErrorMsg('');
        setStatus('idle');
      } catch (err) {
        setErrorMsg('Uploaded file is not a valid JSON.');
        setStatus('error');
      }
    };
    reader.onerror = () => {
      setErrorMsg('Error reading file.');
      setStatus('error');
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setErrorMsg('');
    } catch (e) {
      setErrorMsg("Invalid JSON: Cannot format.");
      setStatus('error');
    }
  };

  const validateJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);

      if (!parsed.target_date) {
        throw new Error("Missing required field: 'target_date'");
      }

      // Basic date validation
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.target_date)) {
        throw new Error("'target_date' must be in YYYY-MM-DD format.");
      }

      if (!parsed.surface_observations) {
        throw new Error("Missing required field: 'surface_observations'");
      }

      const obs = parsed.surface_observations;

      // If it's a dict
      if (!Array.isArray(obs)) {
        const requiredKeys = ["sst_c", "sss_psu", "sla_m", "u_current_ms", "v_current_ms", "u_wind_ms", "v_wind_ms"];
        for (const key of requiredKeys) {
          if (!obs[key]) {
            throw new Error(`Missing feature matrix in surface_observations: '${key}'`);
          }
          if (!Array.isArray(obs[key])) {
            throw new Error(`Feature '${key}' must be a 2D array [101][241]`);
          }
        }
      } else {
        // If it's a 3D tensor
        if (obs.length !== 7) {
          throw new Error("If surface_observations is an array, it must be a 3D tensor of shape [7][101][241]");
        }
      }

      setErrorMsg('');
      return parsed;
    } catch (e) {
      setErrorMsg(e.message);
      setStatus('error');
      return null;
    }
  };

  const handleValidateClick = () => {
    if (validateJson()) {
      setStatus('idle');
      alert("JSON is valid and matches the prediction schema!");
    }
  };

  const handleRun = async () => {
    const payload = validateJson();
    if (!payload) return;

    setStatus('loading');
    setErrorMsg('');

    // Create an object to store the incoming stream
    const resultData = {
      metadata: null,
      slices: [],
      status: 'loading'
    };

    await fetchPredictionData(payload, {
      onMetadata: (meta) => {
        resultData.metadata = meta;
      },
      onSlice: (slice) => {
        resultData.slices.push(slice);
      },
      onComplete: (complete) => {
        resultData.status = 'success';
        // Store in window to avoid React Router state size limits
        window.__PREDICTION_RESULT__ = resultData;
        navigate('/results');
      },
      onError: (err) => {
        setErrorMsg(err.message || "Prediction failed");
        setStatus('error');
      }
    });
  };

  if (status === 'loading') {
    return (
      <div style={{ paddingTop: '100px' }}>
        <LoadingState
          title="Running OceanEmbed Model..."
          description="Processing surface observations and reconstructing the 3D subsurface temperature profile."
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Use Your Data</h1>
        <p className="text-slate-light">Upload surface observations to reconstruct the 3D subsurface temperature profile.</p>
      </div>

      <Card>
        <CardHeader style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <CardTitle>JSON Payload</CardTitle>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" onClick={handleFormat} style={{ padding: '4px 12px', fontSize: '0.75rem' }}>Format JSON</Button>
            <Button variant="outline" onClick={handleValidateClick} style={{ padding: '4px 12px', fontSize: '0.75rem' }}>Validate</Button>
          </div>
        </CardHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {status === 'error' && (
            <div style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)', padding: '16px', borderRadius: 'var(--radius-md)', fontSize: '1.1rem' }}>
              <strong>Validation Error: </strong> {errorMsg}
            </div>
          )}

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '32px',
              textAlign: 'center',
              backgroundColor: isDragging ? 'var(--color-primary-light)' : 'var(--color-off-white)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleFileSelect}
            />
            <Upload size={32} style={{ color: 'var(--color-muted-teal)', marginBottom: '16px', margin: '0 auto' }} />
            <h3 style={{ marginBottom: '8px' }}>Upload JSON File</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-light)' }}>
              Drag and drop your JSON payload here, or click to browse.
            </p>
          </div>

          <div>
            <textarea
              className="input-base"
              style={{ minHeight: '400px', fontFamily: 'monospace', resize: 'vertical', fontSize: '0.875rem' }}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              spellCheck="false"
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)', marginTop: '8px' }}>
              Requires <code>target_date</code> (YYYY-MM-DD) and <code>surface_observations</code> (dict of 7 features).
            </p>
          </div>

          <Button
            variant="primary"
            size="large"
            onClick={handleRun}
            style={{ padding: '16px', fontSize: '1rem' }}
          >
            Run OceanEmbed Model
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default InputPage;
