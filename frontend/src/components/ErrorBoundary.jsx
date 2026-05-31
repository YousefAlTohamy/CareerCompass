import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import {
  hasChunkReloadAttempted,
  isChunkLoadError,
  markChunkReloadAttempted,
} from '../utils/chunkRecovery';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reloadScheduled = false;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    const chunkLoadError = isChunkLoadError(error);

    console.error('React Error Boundary caught an error:', error, errorInfo);

    if (!chunkLoadError || hasChunkReloadAttempted() || this.reloadScheduled) {
      if (chunkLoadError) {
        console.warn('Chunk recovery already attempted; showing manual refresh fallback.');
      }
      return;
    }

    this.reloadScheduled = true;
    // Chunk failures usually mean the browser has an old lazy-loaded file.
    // Mark the tab before reloading so a persistent failure falls back to the manual screen.
    markChunkReloadAttempted();
    console.warn('Detected stale frontend assets. Reloading once to recover.');

    window.setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || '';
      const chunkLoadError = isChunkLoadError(this.state.error);
      const chunkReloadAttempted = chunkLoadError && hasChunkReloadAttempted();

      if (chunkLoadError && !chunkReloadAttempted) {
        return (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 font-sans">
            <div className="glass-card p-10 max-w-md w-full border-indigo-500/20 bg-white dark:bg-slate-900 shadow-2xl text-center space-y-8">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto text-indigo-500 border border-indigo-500/20 shadow-lg">
                <RefreshCw size={42} className="animate-spin" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Refreshing Interface</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  Loading the latest dashboard files...
                </p>
              </div>
            </div>
          </div>
        );
      }

      const recoveryMessage = chunkLoadError
        ? 'The frontend assets were refreshed while this page was open. Please refresh once to load the latest dashboard files.'
        : (message || 'An unexpected runtime error occurred during synthesis.');
      const title = chunkLoadError ? 'Interface Refresh Required' : 'SYSTEM_HALT';
      const buttonLabel = chunkLoadError ? 'Refresh Page' : 'Re-initialize App';
      const buttonTextClass = chunkLoadError ? 'tracking-wide' : 'uppercase tracking-widest';

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 font-sans">
          <div className="glass-card p-10 max-w-md w-full border-rose-500/20 bg-white dark:bg-slate-900 shadow-2xl text-center space-y-8">
            <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto text-rose-500 border border-rose-500/20 shadow-lg">
              <AlertCircle size={48} />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{title}</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                {recoveryMessage}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className={`w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 transition-all ${buttonTextClass}`}
            >
              <RefreshCw size={18} /> {buttonLabel}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
