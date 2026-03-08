import React from "react";

/**
 * Error Boundary Component
 * Catches errors in child components and displays fallback UI
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "20px",
            margin: "16px",
            border: "1px solid #f5222d",
            borderRadius: "6px",
            backgroundColor: "#fff2f0",
            color: "#8b0000",
          }}
        >
          <h3 style={{ marginTop: 0 }}>❌ Something went wrong</h3>
          <p>
            {this.state.error && this.state.error.toString()}
          </p>
          {process.env.NODE_ENV === "development" && this.state.errorInfo && (
            <pre
              style={{
                backgroundColor: "#f5f5f5",
                padding: "12px",
                borderRadius: "4px",
                overflow: "auto",
                fontSize: "12px",
              }}
            >
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="btn-primary"
            style={{ padding: "8px 16px", marginTop: "12px" }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
