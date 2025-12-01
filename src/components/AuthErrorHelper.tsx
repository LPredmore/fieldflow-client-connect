/**
 * Authentication Error Helper Component
 * 
 * Displays helpful debugging information when authentication fails,
 * including circuit breaker state and network diagnostics.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, RefreshCw, Wifi, WifiOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { authDebugger } from '@/utils/authDebugger';
import { smartSupabaseCircuitBreaker } from '@/utils/smartCircuitBreakerInstance';

interface AuthErrorHelperProps {
  error?: string | null;
  onRetry?: () => void;
}

export function AuthErrorHelper({ error, onRetry }: AuthErrorHelperProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  if (!error) return null;

  const isNetworkError = error.includes('network') || 
                        error.includes('connection') || 
                        error.includes('fetch') ||
                        !navigator.onLine;

  const handleShowDiagnostics = () => {
    const diag = authDebugger.exportDiagnostics();
    setDiagnostics(diag);
    setShowDiagnostics(true);
  };

  const getCircuitBreakerStatus = () => {
    try {
      const state = smartSupabaseCircuitBreaker.getEnhancedState();
      return {
        state: state.state,
        isOpen: state.state === 'OPEN',
        failureCount: state.failureCount || 0
      };
    } catch {
      return { state: 'UNKNOWN', isOpen: false, failureCount: 0 };
    }
  };

  const circuitBreakerStatus = getCircuitBreakerStatus();

  return (
    <Card className="mt-4 border-destructive/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {navigator.onLine ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <CardTitle className="text-sm">Connection Issue Detected</CardTitle>
        </div>
        <CardDescription className="text-sm">
          {isNetworkError 
            ? "There seems to be a network connectivity issue. Here are some things you can try:"
            : "Authentication failed. Here are some troubleshooting steps:"
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Quick fixes */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Quick Fixes:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Check your internet connection</li>
            <li>• Try refreshing the page</li>
            <li>• Disable any ad blockers or VPN temporarily</li>
            <li>• Clear your browser cache and cookies</li>
            {circuitBreakerStatus.isOpen && (
              <li>• Wait a moment - our system is recovering from high load</li>
            )}
          </ul>
        </div>

        {/* System status */}
        <div className="flex items-center gap-2 text-sm">
          <span>System Status:</span>
          <Badge variant={circuitBreakerStatus.isOpen ? "destructive" : "secondary"}>
            {circuitBreakerStatus.isOpen ? "Recovering" : "Normal"}
          </Badge>
          <Badge variant={navigator.onLine ? "secondary" : "destructive"}>
            {navigator.onLine ? "Online" : "Offline"}
          </Badge>
        </div>

        {/* Retry button */}
        {onRetry && (
          <Button 
            onClick={onRetry} 
            variant="outline" 
            size="sm"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}

        {/* Advanced diagnostics */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="diagnostics">
            <AccordionTrigger 
              className="text-sm py-2"
              onClick={handleShowDiagnostics}
            >
              Advanced Diagnostics
            </AccordionTrigger>
            <AccordionContent>
              {diagnostics && (
                <div className="space-y-2 text-xs">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>For Support:</strong> Copy this information when contacting support.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="bg-muted p-2 rounded text-xs font-mono overflow-auto max-h-40">
                    <div><strong>Timestamp:</strong> {diagnostics.timestamp}</div>
                    <div><strong>Online:</strong> {diagnostics.online ? 'Yes' : 'No'}</div>
                    <div><strong>Circuit Breaker:</strong> {diagnostics.circuitBreakerState?.state || 'Unknown'}</div>
                    <div><strong>Local Storage:</strong> {diagnostics.localStorage?.localStorageEnabled ? 'Working' : 'Blocked'}</div>
                    <div><strong>Recent Errors:</strong> {diagnostics.networkErrorLogs?.length || 0}</div>
                    <div><strong>Auth Attempts:</strong> {diagnostics.authLogs?.length || 0}</div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(JSON.stringify(diagnostics, null, 2));
                    }}
                    className="w-full"
                  >
                    Copy Diagnostics to Clipboard
                  </Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}