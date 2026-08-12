import React, { Component, ErrorInfo, ReactNode } from "react";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an uncaught exception:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-xl border border-gray-100 text-center space-y-6">
            <div className="mx-auto bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center border border-red-100">
              <ShieldAlert className="h-8 w-8 text-red-600 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-black text-gray-800 tracking-tight">Something Went Wrong</h1>
              <p className="text-sm text-gray-500 font-semibold leading-relaxed">
                A component in your workspace encountered a runtime crash.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-50 border rounded-2xl p-4 text-left text-xs font-mono text-gray-600 max-h-36 overflow-y-auto leading-relaxed">
                <span className="block font-black text-red-700 mb-1">Error Trace:</span>
                {this.state.error.stack || this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-4 justify-center pt-2">
              <button
                onClick={() => window.location.hash = "#/"}
                className="px-5 py-2.5 border rounded-xl text-gray-600 hover:bg-slate-50 transition text-sm font-bold flex items-center gap-1.5"
              >
                <Home className="h-4 w-4" />
                <span>Go to Home</span>
              </button>
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 bg-forgeBlue text-white rounded-xl hover:bg-blue-800 transition text-sm font-bold flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
