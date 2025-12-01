import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GracefulDataWrapper } from '@/components/ui/graceful-data-wrapper';
import { EnhancedEmptyState } from '@/components/ui/enhanced-empty-state';
import { RetryMechanism } from '@/components/ui/retry-mechanism';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ErrorType } from '@/utils/circuitBreaker';

// Mock components
const MockChild = ({ data }: { data: any[] }) => (
  <div data-testid="mock-child">
    {data.map((item, index) => (
      <div key={index} data-testid={`item-${index}`}>
        {item.name}
      </div>
    ))}
  </div>
);

const ThrowingComponent = () => {
  throw new Error('Test error');
};

describe('Graceful Degradation Components', () => {
  describe('GracefulDataWrapper', () => {
    const mockData = [
      { name: 'Item 1' },
      { name: 'Item 2' },
      { name: 'Item 3' }
    ];

    it('shows loading state when loading and no data', () => {
      render(
        <GracefulDataWrapper
          loading={true}
          error={null}
          data={[]}
          onRetry={vi.fn()}
        >
          <MockChild data={mockData} />
        </GracefulDataWrapper>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows data when loaded successfully', () => {
      render(
        <GracefulDataWrapper
          loading={false}
          error={null}
          data={mockData}
          onRetry={vi.fn()}
        >
          <MockChild data={mockData} />
        </GracefulDataWrapper>
      );

      expect(screen.getByTestId('mock-child')).toBeInTheDocument();
      expect(screen.getByTestId('item-0')).toHaveTextContent('Item 1');
    });

    it('shows cached data with indicator when circuit breaker is open', () => {
      render(
        <GracefulDataWrapper
          loading={false}
          error={null}
          data={mockData}
          isCircuitBreakerOpen={true}
          lastUpdated={new Date()}
          onRetry={vi.fn()}
        >
          <MockChild data={mockData} />
        </GracefulDataWrapper>
      );

      expect(screen.getByTestId('mock-child')).toBeInTheDocument();
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    it('shows error state when no cached data available', () => {
      render(
        <GracefulDataWrapper
          loading={false}
          error="Network error"
          errorType={ErrorType.NETWORK_ERROR}
          data={[]}
          onRetry={vi.fn()}
        >
          <MockChild data={[]} />
        </GracefulDataWrapper>
      );

      expect(screen.getByText(/connection problem/i)).toBeInTheDocument();
      expect(screen.getByText(/try again/i)).toBeInTheDocument();
    });

    it('shows stale data with refresh option', () => {
      const mockRefresh = vi.fn();
      
      render(
        <GracefulDataWrapper
          loading={false}
          error={null}
          data={mockData}
          isStale={true}
          lastUpdated={new Date(Date.now() - 300000)} // 5 minutes ago
          onRefresh={mockRefresh}
        >
          <MockChild data={mockData} />
        </GracefulDataWrapper>
      );

      expect(screen.getByTestId('mock-child')).toBeInTheDocument();
      expect(screen.getByText(/cached data/i)).toBeInTheDocument();
      
      const refreshButton = screen.getByText(/refresh/i);
      fireEvent.click(refreshButton);
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('shows empty state when no data and not loading', () => {
      render(
        <GracefulDataWrapper
          loading={false}
          error={null}
          data={[]}
          emptyStateTitle="No items found"
          emptyStateDescription="Add some items to get started"
          onRetry={vi.fn()}
        >
          <MockChild data={[]} />
        </GracefulDataWrapper>
      );

      expect(screen.getByText('No items found')).toBeInTheDocument();
      expect(screen.getByText('Add some items to get started')).toBeInTheDocument();
    });
  });

  describe('EnhancedEmptyState', () => {
    it('renders empty state correctly', () => {
      render(
        <EnhancedEmptyState
          type="empty"
          title="No data"
          description="Nothing to show"
          onRetry={vi.fn()}
        />
      );

      expect(screen.getByText('No data')).toBeInTheDocument();
      expect(screen.getByText('Nothing to show')).toBeInTheDocument();
    });

    it('renders circuit breaker state with cached data info', () => {
      const lastUpdated = new Date(Date.now() - 600000); // 10 minutes ago
      
      render(
        <EnhancedEmptyState
          type="circuit_breaker"
          lastUpdated={lastUpdated}
          cachedDataCount={5}
          onRetry={vi.fn()}
        />
      );

      expect(screen.getByText(/service temporarily unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/showing 5 cached items/i)).toBeInTheDocument();
    });

    it('renders error state with appropriate icon and message', () => {
      render(
        <EnhancedEmptyState
          type="error"
          errorType={ErrorType.PERMISSION_ERROR}
          error="Access denied"
          onRetry={vi.fn()}
        />
      );

      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      expect(screen.getByText(/permission/i)).toBeInTheDocument();
    });

    it('renders compact version correctly', () => {
      render(
        <EnhancedEmptyState
          type="error"
          error="Test error"
          onRetry={vi.fn()}
          compact={true}
        />
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });
  });

  describe('RetryMechanism', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('handles manual retry correctly', async () => {
      const mockRetry = vi.fn().mockResolvedValue(undefined);
      
      render(
        <RetryMechanism
          onRetry={mockRetry}
          error="Network error"
          maxRetries={3}
        />
      );

      const retryButton = screen.getByText(/retry now/i);
      fireEvent.click(retryButton);

      expect(mockRetry).toHaveBeenCalled();
    });

    it('shows auto-retry countdown', async () => {
      const mockRetry = vi.fn().mockResolvedValue(undefined);
      
      render(
        <RetryMechanism
          onRetry={mockRetry}
          autoRetry={true}
          retryDelay={5000}
          maxRetries={3}
        />
      );

      expect(screen.getByText(/auto-retry in \d+s/i)).toBeInTheDocument();
    });

    it('disables retry after max attempts', () => {
      const mockRetry = vi.fn().mockRejectedValue(new Error('Still failing'));
      
      render(
        <RetryMechanism
          onRetry={mockRetry}
          maxRetries={1}
        />
      );

      const retryButton = screen.getByText(/retry now/i);
      fireEvent.click(retryButton);

      waitFor(() => {
        expect(screen.getByText(/max retries reached/i)).toBeInTheDocument();
      });
    });

    it('does not auto-retry for permission errors', () => {
      render(
        <RetryMechanism
          onRetry={vi.fn()}
          errorType={ErrorType.PERMISSION_ERROR}
          autoRetry={true}
        />
      );

      expect(screen.queryByText(/auto-retry/i)).not.toBeInTheDocument();
    });
  });

  describe('ErrorBoundary', () => {
    // Suppress console.error for these tests
    const originalError = console.error;
    beforeEach(() => {
      console.error = vi.fn();
    });

    afterEach(() => {
      console.error = originalError;
    });

    it('catches and displays errors', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText(/try again/i)).toBeInTheDocument();
    });

    it('allows retry after error', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      const retryButton = screen.getByText(/try again/i);
      fireEvent.click(retryButton);

      // Rerender with a working component
      rerender(
        <ErrorBoundary>
          <div>Working component</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Working component')).toBeInTheDocument();
    });

    it('shows error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary showErrorDetails={true}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      const detailsButton = screen.getByText(/show details/i);
      fireEvent.click(detailsButton);

      expect(screen.getByText(/test error/i)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('calls custom error handler', () => {
      const mockErrorHandler = vi.fn();

      render(
        <ErrorBoundary onError={mockErrorHandler}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(mockErrorHandler).toHaveBeenCalled();
    });

    it('renders custom fallback', () => {
      const customFallback = <div>Custom error message</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });
});