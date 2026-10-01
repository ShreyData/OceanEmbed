// API Client for OceanEmbed
// Uses relative paths which are proxied to the backend via Vite.

export async function fetchMetadata() {
  try {
    const [boundsRes, depthsRes, datesRes] = await Promise.all([
      fetch('/api/v1/metadata/bounds'),
      fetch('/api/v1/metadata/depths'),
      fetch('/api/v1/metadata/available-dates')
    ]);

    if (!boundsRes.ok || !depthsRes.ok || !datesRes.ok) {
      throw new Error('Failed to fetch metadata from the server.');
    }

    const bounds = await boundsRes.json();
    const depths = await depthsRes.json();
    const dates = await datesRes.json();

    return {
      bounds,
      depths: depths.valid_depths_meters,
      dates
    };
  } catch (error) {
    console.error("API Error (fetchMetadata):", error);
    throw error;
  }
}

export async function fetchHistoricalData(params, callbacks) {
  const { onMetadata, onSlice, onComplete, onError } = callbacks;
  try {
    const url = new URL('/api/v1/ocean/historical', window.location.origin);
    Object.keys(params).forEach(key => {
      if (params[key] !== '' && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      buffer = lines.pop() || ''; // Keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.type === 'metadata' && onMetadata) onMetadata(chunk);
          else if (chunk.type === 'depth_slice' && onSlice) onSlice(chunk);
          else if (chunk.type === 'complete' && onComplete) onComplete(chunk);
          else if (chunk.type === 'error') throw new Error(chunk.detail || 'API Error');
        } catch (e) {
          if (e.message !== 'Unexpected end of JSON input') {
            console.error("Error parsing NDJSON chunk:", e);
            throw e;
          }
        }
      }
    }

    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer);
        if (chunk.type === 'complete' && onComplete) onComplete(chunk);
        else if (chunk.type === 'error') throw new Error(chunk.detail || 'API Error');
      } catch (e) {
        console.error("Error parsing final NDJSON chunk:", e);
      }
    }
  } catch (error) {
    if (onError) onError(error);
  }
}

export async function fetchPredictionData(payload, callbacks) {
  const { onMetadata, onSlice, onComplete, onError } = callbacks;
  try {
    const url = new URL('/api/v1/ocean/predict', window.location.origin);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 422) {
        throw new Error("Your input data is not valid as per model requirement, it should be as given format 7*101*241 Data points needed");
      }

      const errorText = await response.text();
      let detail = errorText;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.detail) detail = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
      } catch (e) { }
      throw new Error(`Server Error ${response.status}: ${detail}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      buffer = lines.pop() || ''; // Keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.type === 'metadata' && onMetadata) onMetadata(chunk);
          else if (chunk.type === 'depth_slice' && onSlice) onSlice(chunk);
          else if (chunk.type === 'complete' && onComplete) onComplete(chunk);
          else if (chunk.type === 'error') throw new Error(chunk.detail || 'API Error');
        } catch (e) {
          if (e.message !== 'Unexpected end of JSON input') {
            console.error("Error parsing NDJSON chunk:", e);
            throw e;
          }
        }
      }
    }

    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer);
        if (chunk.type === 'complete' && onComplete) onComplete(chunk);
        else if (chunk.type === 'error') throw new Error(chunk.detail || 'API Error');
      } catch (e) {
        console.error("Error parsing final NDJSON chunk:", e);
      }
    }
  } catch (error) {
    if (onError) onError(error);
  }
}
