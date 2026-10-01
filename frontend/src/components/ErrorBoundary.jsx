import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '40px auto', background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: '8px' }}>
          <h2 style={{ color: '#cf1322', marginTop: 0 }}>⚠️ Frontend Application Error</h2>
          <p style={{ color: '#434343' }}>An error occurred while rendering this page:</p>
          <pre style={{ background: '#fff', padding: '16px', borderRadius: '4px', overflowX: 'auto', color: '#a8071a', border: '1px solid #ffccc7' }}>
            {this.state.error?.toString()}
          </pre>
          {this.state.errorInfo && (
            <details style={{ marginTop: '16px' }}>
              <summary style={{ cursor: 'pointer', color: '#096dd9' }}>Component Stack Trace</summary>
              <pre style={{ background: '#fafafa', padding: '12px', fontSize: '12px', overflowX: 'auto' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => {
              window.location.href = '/input';
            }}
            style={{ marginTop: '20px', padding: '8px 16px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Return to Upload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
export default ErrorBoundary;
