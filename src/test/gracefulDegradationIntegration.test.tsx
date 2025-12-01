import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RecentJobs from '@/components/Dashboard/RecentJobs';
import { useUnifiedAppointments } from '@/hooks/useUnifiedAppointments';
import { ErrorType } from '@/utils/circuitBreaker';

// Mock the hook
vi.mock('@/hooks/useUnifiedAppointments');
vi.mock('@/hooks/useUserTimezone', () => ({
  useUserTimezone: () => 'America/New_York'
}));

const mockUseUnifiedAppointments = vi.mocked(useUnifiedAppointments);

const mockAppointments = [
  {
    id: '1',
    customer_name: 'John Doe',
    title: 'Plumbing Repair',
    description: 'Fix kitchen sink',
    status: 'scheduled' as const,
    priority: 'high' as const,
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    appointment_type: 'one_time' as const,
    created_at: new Date().toISOString(),
    tenant_id: 'test-tenant',
    created_by_user_id: 'test-user',
    customer_id: 'customer-1'
  },
  {
    id: '2',
    customer_name: 'Jane Smith',
    title: 'HVAC Maintenance',
    description: 'Annual checkup',
    status: 'in_progress' as const,
    priority: 'medium' as const,
    start_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    end_at: new Date(Date.now() + 7200000).toISOString(),
    appointment_type: 'recurring_instance' as const,
    created_at: new Date().toISOString(),
    tenant_id: 'test-tenant',
    created_by_user_id: 'test-user',
    customer_id: 'customer-2'
  }
];

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Graceful Degradation Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RecentJobs Component', () => {
    it('displays appointments normally when data loads successfully', () => {
      mockUseUnifiedAppointments.mockReturnValue({
        upcomingJobs: mockAppointments,
        loading: false,
        error: null,
        refetchJobs: vi.fn(),
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: new Date(),
        errorType: null,
        unifiedJobs: mockAppointments,
        updateJob: vi.fn(),
        deleteJob: vi.fn()
      });

      render(
        <TestWrapper>
          <RecentJobs />
        </TestWrapper>
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Plumbing Repair')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('HVAC Maintenance')).toBeInTheDocument();
    });

    it('shows loading skeleton when data is loading', () => {
      mockUseUnifiedAppointments.mockReturnValue({
        upcomingJobs: [],
        loading: true,
        error: null,
        refetchJobs: vi.fn(),
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: null,
        unifiedJobs: [],
        updateJob: vi.fn(),
        deleteJob: vi.fn()
      });

      render(
        <TestWrapper>
          <RecentJobs />
        </TestWrapper>
      );

      // Should show loading skeleton
      const skeletons = screen.getAllByRole('generic');
      expect(skeletons.some(el => el.classList.contains('animate-pulse'))).toBe(true);
    });

    it('shows cached data with indicator when circuit breaker is open', () => {
      const lastUpdated = new Date(Date.now() - 300000); // 5 minutes ago
      const mockRefetch = vi.fn();

      mockUseUnifiedAppointments.mockReturnValue({
        upcomingJobs: mockAppointments,
        loading: false,
        error: 'Service temporarily unavailable - showing cached data',
        refetchJobs: mockRefetch,
        isStale: false,
        isCircuitBreakerOpen: true,
        lastUpdated,
        errorType: ErrorType.NETWORK_ERROR,
        unifiedJobs: mockAppointments,
        updateJob: vi.fn(),
        deleteJob: vi.fn()
      });

      render(
        <TestWrapper>
          <RecentJobs />
        </TestWrapper>
      );

      // Should show cached data
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();

      // Should show offline indicator
      expect(screen.getByText(/offline/i)).toBeInTheDocument();

      // Should have refresh button
      const refreshButton = screen.getByText(/refresh/i);
      fireEvent.click(refreshButton);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('shows stale data with refresh indicator', () => {
      const lastUpdated = new Date(Date.now() - 600000); // 10 minutes ago
      const mockRefetch = vi.fn();

      mockUseUnifiedAppointments.mockReturnValue({
        upcomingJobs: mockAppointments,
        loading: false,
        error: null,
        refetchJobs: mockRefetch,
        isStale: true,
        isCircuitBreakerOpen: false,
        lastUpdated,
        errorType: null,
        unifiedJobs: mockAppointments,
        updateJob: vi.fn(),
        deleteJob: vi.fn()
      });

      render(
        <TestWrapper>
          <RecentJobs />
        </TestWrapper>
      );

      // Should show stale data
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();

      // Should show cached data indicator
      expect(screen.getByText(/cached data/i)).toBeInTheDocument();

      // Should have refresh button
      const refreshButton = screen.getByText(/refresh/i);
      fireEvent.click(refreshButton);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('shows error state when no cached data is available', () => {
      const mockRefetch = vi.fn();

      mockUseUnifiedAppointments.mockReturnValue({
        upcomingJobs: [],
        loading: false,
        error: 'Network connection failed',
        refetchJobs: mockRefetch,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: ErrorType.NETWORK_ERROR,
        unifiedJobs: [],
        updateJob: vi.fn(),
        deleteJob: vi.fn()
      });

      render(
        <TestWrapper>
          <RecentJobs />
        </TestWrapper>
      );

      // Should show error state
      expect(screen.getByText(/connection problem/i)).toBeInTheDocument();
      expect(screen.getByText(/try again/i)).toBeInTheDocument();

      // Should have retry button
      const retryButton = screen.getByText(/try again/i);
      fireEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('shows empty state when no appointments exist', () => {
      mockUseUnifiedAppointments.mockReturnValue({
        upcomingJobs: [],
        loading: false,
        error: null,
        refetchJobs: vi.fn(),
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: new Date(),
        errorType: null,
        unifiedJobs: [],
        updateJob: vi.fn(),
        deleteJob: vi.fn()
      });

      render(
        <TestWrapper>
          <RecentJobs />
        </TestWrapper>
      );

      // Should show empty state
      expect(screen.getByText(/no appointments found/i)).toBeInTheDocument();
      expect(screen.getByText(/create your first appointment/i)).toBeInTheDocument();
    });

    it('handles schema mismatch errors gracefully', () => {
      const mockRefetch = vi.fn();

      mockUseUnifiedAppointments.mockReturnValue({
        upcomingJobs: [],
        loading: false,
        error: 'Column "notes" does not exist',
        refetchJobs: mockRefetch,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: ErrorType.SCHEMA_MISMATCH,
        unifiedJobs: [],
        updateJob: vi.fn(),
        deleteJob: vi.fn()
      });

      render(
        <TestWrapper>
          <RecentJobs />
        </TestWrapper>
      );

      // Should show schema error state
      expect(screen.getByText(/data structure issue/i)).toBeInTheDocument();
      expect(screen.getByText(/contact support/i)).toBeInTheDocument();

      // Should still have retry button for manual retry
      const retryButton = screen.getByText(/try again/i);
      fireEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('handles permission errors appropriately', () => {
      const mockRefetch = vi.fn();

      mockUseUnifiedAppointments.mockReturnValue({
        upcomingJobs: [],
        loading: false,
        error: 'Access denied',
        refetchJobs: mockRefetch,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: ErrorType.PERMISSION_ERROR,
        unifiedJobs: [],
        updateJob: vi.fn(),
        deleteJob: vi.fn()
      });

      render(
        <TestWrapper>
          <RecentJobs />
        </TestWrapper>
      );

      // Should show permission error state
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      expect(screen.getByText(/permission/i)).toBeInTheDocument();

      // Should still have retry button
      const retryButton = screen.getByText(/try again/i);
      fireEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('handles timeout errors with appropriate messaging', () => {
      const mockRefetch = vi.fn();

      mockUseUnifiedAppointments.mockReturnValue({
        upcomingJobs: [],
        loading: false,
        error: 'Request timeout',
        refetchJobs: mockRefetch,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: ErrorType.TIMEOUT_ERROR,
        unifiedJobs: [],
        updateJob: vi.fn(),
        deleteJob: vi.fn()
      });

      render(
        <TestWrapper>
          <RecentJobs />
        </TestWrapper>
      );

      // Should show timeout error state
      expect(screen.getByText(/request timeout/i)).toBeInTheDocument();
      expect(screen.getByText(/took too long/i)).toBeInTheDocument();

      // Should have retry button
      const retryButton = screen.getByText(/try again/i);
      fireEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('gracefully handles mixed states (loading with stale data)', () => {
      const lastUpdated = new Date(Date.now() - 120000); // 2 minutes ago
      const mockRefetch = vi.fn();

      mockUseUnifiedAppointments.mockReturnValue({
        upcomingJobs: mockAppointments,
        loading: true, // Still loading fresh data
        error: null,
        refetchJobs: mockRefetch,
        isStale: true, // But showing stale data
        isCircuitBreakerOpen: false,
        lastUpdated,
        errorType: null,
        unifiedJobs: mockAppointments,
        updateJob: vi.fn(),
        deleteJob: vi.fn()
      });

      render(
        <TestWrapper>
          <RecentJobs />
        </TestWrapper>
      );

      // Should show stale data (not loading skeleton)
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();

      // Should show cached data indicator
      expect(screen.getByText(/cached data/i)).toBeInTheDocument();
    });
  });
});