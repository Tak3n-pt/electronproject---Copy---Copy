import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { withTranslation } from 'react-i18next';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0,
      maxRetries: 3
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    const { retryCount, maxRetries } = this.state;
    
    if (retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1
      });
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, retryCount, maxRetries } = this.state;
      const { t } = this.props;
      const canRetry = retryCount < maxRetries;

      return (
        <div className="min-h-screen bg-gaming-black flex items-center justify-center p-6">
          <div className="bg-gaming-gray border border-red-500/50 rounded-xl p-8 max-w-2xl w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-400" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-gaming-yellow mb-2">{t('errorBoundary.somethingWentWrong')}</h1>
              <p className="text-gaming-purple">
                {t('errorBoundary.unexpectedError')}
              </p>
            </div>

            {/* Error Details (in development) */}
            {process.env.NODE_ENV === 'development' && error && (
              <div className="bg-gaming-black/50 rounded-lg p-4 mb-6 border border-gaming-purple/30">
                <div className="flex items-center space-x-2 mb-3">
                  <Bug className="text-red-400" size={16} />
                  <h3 className="text-red-400 font-semibold">{t('errorBoundary.errorDetails')}</h3>
                </div>
                <div className="text-sm text-gaming-purple space-y-2">
                  <div>
                    <strong>{t('errorBoundary.error')}</strong> {error.toString()}
                  </div>
                  {errorInfo && errorInfo.componentStack && (
                    <div>
                      <strong>{t('errorBoundary.componentStack')}</strong>
                      <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Common Issues & Solutions */}
            <div className="bg-gaming-black/30 rounded-lg p-4 mb-6 border border-gaming-purple/20">
              <h3 className="text-gaming-yellow font-semibold mb-3">{t('errorBoundary.commonSolutions')}</h3>
              <ul className="text-gaming-purple text-sm space-y-2">
                <li>• {t('errorBoundary.checkServerRunning')}</li>
                <li>• {t('errorBoundary.checkConnection')}</li>
                <li>• {t('errorBoundary.tryRefresh')}</li>
                <li>• {t('errorBoundary.clearCache')}</li>
                <li>• {t('errorBoundary.restartApp')}</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  className="flex items-center space-x-2 px-6 py-3 bg-gaming-yellow text-gaming-black font-bold rounded-lg hover:bg-gaming-yellow-dark transition-colors"
                >
                  <RefreshCw size={18} />
                  <span>{t('errorBoundary.tryAgain')} ({maxRetries - retryCount} left)</span>
                </button>
              )}
              
              <button
                onClick={this.handleReset}
                className="flex items-center space-x-2 px-6 py-3 bg-gaming-purple text-white rounded-lg hover:bg-gaming-purple-dark transition-colors"
              >
                <Home size={18} />
                <span>{t('errorBoundary.resetApp')}</span>
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="flex items-center space-x-2 px-6 py-3 bg-gaming-gray border border-gaming-purple/50 text-gaming-purple rounded-lg hover:border-gaming-purple transition-colors"
              >
                <RefreshCw size={18} />
                <span>{t('errorBoundary.reloadPage')}</span>
              </button>
            </div>

            {/* Retry Info */}
            {retryCount > 0 && (
              <div className="mt-4 text-center">
                <p className="text-gaming-purple text-sm">
                  {t('errorBoundary.attempted')} {retryCount} {retryCount > 1 ? t('errorBoundary.times') : t('errorBoundary.time')}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);