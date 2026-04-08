import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unexpected error",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled render error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="page">
          <h1>Something went wrong</h1>
          <p className="text-muted">
            A runtime error occurred. Refresh the page or navigate back to
            Browse.
          </p>
          <div className="alert error">{this.state.errorMessage}</div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
