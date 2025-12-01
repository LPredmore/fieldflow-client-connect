/**
 * Auth Debugger - Stub Implementation
 */
export const authDebugger = {
  log: (...args: any[]) => console.log('[AuthDebugger]', ...args),
  error: (...args: any[]) => console.error('[AuthDebugger]', ...args),
  warn: (...args: any[]) => console.warn('[AuthDebugger]', ...args),
  debug: (...args: any[]) => console.debug('[AuthDebugger]', ...args),
  exportDiagnostics: () => JSON.stringify({
    timestamp: new Date().toISOString(),
    logs: []
  }),
  logNetworkError: (error: any, context?: string) => {
    console.error('[AuthDebugger Network Error]', context || 'Unknown context', error);
  }
};
