import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GracefulDataWrapper } from '@/components/ui/graceful-data-wrapper';
import { RetryMechanism } from '@/components/ui/retry-mechanism';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { EnhancedEmptyState } from '@/components/ui/enhanced-empty-state';
import { ErrorType } from '@/utils/circuitBreaker';

interface ExampleData {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

const mockData: ExampleData[] = [
  { id: '1', name: 'Item 1', status: 'active' },
  { id: '2', name: 'Item 2', status: 'inactive' },
  { id: '3', name: 'Item 3', status: 'active' },
];

export function GracefulDegradationExample() {
  const [simulatedState, setSimulatedState] = useState<{
    loading: boolean;
    error: string | null;
    errorType: ErrorType | null;
    data: ExampleData[];
    isStale: boolean;
    isCircuitBreakerOpen: boolean;
    lastUpdated: Date | null;
  }>({
    loading: false,
    error: null,
    errorType: null,
    data: mockData,
    isStale: false,
    isCircuitBreakerOpen: false,
    lastUpdated: new Date(),
  });

  const simulateLoading = () => {
    setSimulatedState(prev => ({
      ...prev,
      loading: true,
      error: null,
      data: [],
    }));
    
    setTimeout(() => {
      setSimulatedState(prev => ({
        ...prev,
        loading: false,
        data: mockData,
        lastUpdated: new Date(),
      }));
    }, 2000);
  };

  const simulateError = (errorType: ErrorType) => {
    const errorMessages = {
      [ErrorType.NETWORK_ERROR]: 'Network connection failed',
      [ErrorType.PERMISSION_ERROR]: 'Access denied to this resource',
      [ErrorType.TIMEOUT_ERROR]: 'Request timed out after 30 seconds',
      [ErrorType.SCHEMA_MISMATCH]: 'Database schema mismatch detected',
    };

    setSimulatedState(prev => ({
      ...prev,
      loading: false,
      error: errorMessages[errorType],
      errorType,
      data: [],
    }));
  };

  const simulateCircuitBreaker = () => {
    setSimulatedState(prev => ({
      ...prev,
      loading: false,
      error: 'Service temporarily unavailable - showing cached data',
      errorType: ErrorType.NETWORK_ERROR,
      data: mockData, // Keep cached data
      isCircuitBreakerOpen: true,
      lastUpdated: new Date(Date.now() - 300000), // 5 minutes ago
    }));
  };

  const simulateStaleData = () => {
    setSimulatedState(prev => ({
      ...prev,
      loading: false,
      error: null,
      errorType: null,
      data: mockData,
      isStale: true,
      isCircuitBreakerOpen: false,
      lastUpdated: new Date(Date.now() - 600000), // 10 minutes ago
    }));
  };

  const simulateEmpty = () => {
    setSimulatedState(prev => ({
      ...prev,
      loading: false,
      error: null,
      errorType: null,
      data: [],
      isStale: false,
      isCircuitBreakerOpen: false,
      lastUpdated: new Date(),
    }));
  };

  const simulateSuccess = () => {
    setSimulatedState({
      loading: false,
      error: null,
      errorType: null,
      data: mockData,
      isStale: false,
      isCircuitBreakerOpen: false,
      lastUpdated: new Date(),
    });
  };

  const handleRetry = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    simulateSuccess();
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Graceful Degradation Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={simulateSuccess} variant="outline" size="sm">
              Success State
            </Button>
            <Button onClick={simulateLoading} variant="outline" size="sm">
              Loading State
            </Button>
            <Button onClick={simulateEmpty} variant="outline" size="sm">
              Empty State
            </Button>
            <Button onClick={() => simulateError(ErrorType.NETWORK_ERROR)} variant="outline" size="sm">
              Network Error
            </Button>
            <Button onClick={() => simulateError(ErrorType.PERMISSION_ERROR)} variant="outline" size="sm">
              Permission Error
            </Button>
            <Button onClick={() => simulateError(ErrorType.TIMEOUT_ERROR)} variant="outline" size="sm">
              Timeout Error
            </Button>
            <Button onClick={() => simulateError(ErrorType.SCHEMA_MISMATCH)} variant="outline" size="sm">
              Schema Error
            </Button>
            <Button onClick={simulateCircuitBreaker} variant="outline" size="sm">
              Circuit Breaker
            </Button>
            <Button onClick={simulateStaleData} variant="outline" size="sm">
              Stale Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Display with Graceful Degradation</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary>
            <GracefulDataWrapper
              loading={simulatedState.loading}
              error={simulatedState.error}
              errorType={simulatedState.errorType}
              data={simulatedState.data}
              isStale={simulatedState.isStale}
              isCircuitBreakerOpen={simulatedState.isCircuitBreakerOpen}
              lastUpdated={simulatedState.lastUpdated}
              onRetry={handleRetry}
              onRefresh={handleRetry}
              emptyStateTitle="No items found"
              emptyStateDescription="Try adding some items to see them here"
            >
              <div className="space-y-2">
                {simulatedState.data.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <span className="font-medium">{item.name}</span>
                    <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </GracefulDataWrapper>
          </ErrorBoundary>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Enhanced Empty States</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EnhancedEmptyState
              type="empty"
              title="No data available"
              description="This is what an empty state looks like"
              compact
            />
            
            <EnhancedEmptyState
              type="circuit_breaker"
              lastUpdated={new Date(Date.now() - 300000)}
              cachedDataCount={3}
              onRetry={handleRetry}
              compact
            />
            
            <EnhancedEmptyState
              type="error"
              errorType={ErrorType.NETWORK_ERROR}
              error="Connection failed"
              onRetry={handleRetry}
              compact
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Retry Mechanism</CardTitle>
          </CardHeader>
          <CardContent>
            <RetryMechanism
              onRetry={handleRetry}
              error="Example error for retry demo"
              errorType={ErrorType.NETWORK_ERROR}
              maxRetries={3}
              retryDelay={5000}
              autoRetry={false}
              compact
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}