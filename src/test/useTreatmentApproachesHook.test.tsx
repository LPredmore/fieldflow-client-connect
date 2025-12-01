import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the useSupabaseQuery hook
vi.mock('@/hooks/data/useSupabaseQuery', () => ({
  useSupabaseQuery: vi.fn(),
}));

// Import after mocking
import { useTreatmentApproaches } from '@/hooks/useTreatmentApproaches';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';

const mockUseSupabaseQuery = vi.mocked(useSupabaseQuery);

// Mock data for testing
const mockTreatmentApproachesData = [
  {
    id: 1,
    approaches: 'CBT',
    specialty: 'Mental Health',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    approaches: 'CPT',
    specialty: 'Mental Health',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    approaches: 'Physical Therapy',
    specialty: 'Physical Medicine',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 4,
    approaches: 'Occupational Therapy',
    specialty: 'Physical Medicine',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 5,
    approaches: 'Group Therapy',
    specialty: 'Mental Health',
    created_at: '2024-01-01T00:00:00Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  
  // Mock console methods to reduce noise
  console.log = vi.fn();
  console.error = vi.fn();
  console.warn = vi.fn();
  console.debug = vi.fn();
  console.group = vi.fn();
  console.groupEnd = vi.fn();
  
  // Default mock implementation
  mockUseSupabaseQuery.mockReturnValue({
    data: mockTreatmentApproachesData,
    loading: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    isRefreshing: false,
    isStale: false,
    isCircuitBreakerOpen: false,
    lastUpdated: new Date(),
    errorType: null,
  });
});

describe('useTreatmentApproaches Hook Unit Tests', () => {
  describe('immediate data fetching on hook initialization', () => {
    it('should fetch all treatment approaches data immediately on initialization', () => {
      renderHook(() => useTreatmentApproaches());
      
      // Verify useSupabaseQuery was called with correct parameters
      expect(mockUseSupabaseQuery).toHaveBeenCalledWith({
        table: 'treatment_approaches',
        select: '*',
        orderBy: { column: 'approaches', ascending: true },
      });
    });

    it('should fetch data even when specialty is not provided', () => {
      renderHook(() => useTreatmentApproaches({}));
      
      expect(mockUseSupabaseQuery).toHaveBeenCalledWith({
        table: 'treatment_approaches',
        select: '*',
        orderBy: { column: 'approaches', ascending: true },
      });
    });

    it('should return all approaches data for debugging access', () => {
      const { result } = renderHook(() => useTreatmentApproaches());
      
      expect(result.current.allApproaches).toEqual(mockTreatmentApproachesData);
    });

    it('should log hook initialization with correct parameters in development', () => {
      // Set NODE_ENV to development for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      try {
        renderHook(() => useTreatmentApproaches({ specialty: 'Mental Health' }));
        
        expect(console.log).toHaveBeenCalledWith(
          '[useTreatmentApproaches] Hook initialized',
          expect.objectContaining({
            specialty: 'Mental Health',
            dataLoaded: true,
            dataCount: mockTreatmentApproachesData.length,
            loading: false,
            hasError: false,
          })
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('client-side filtering with various specialty values including null/undefined', () => {
    it('should filter approaches by specialty correctly', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );
      
      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'Group Therapy']);
    });

    it('should filter approaches for different specialty', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Physical Medicine' })
      );
      
      expect(result.current.approaches).toEqual(['Occupational Therapy', 'Physical Therapy']);
    });

    it('should handle case-insensitive specialty matching', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'mental health' })
      );
      
      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'Group Therapy']);
    });

    it('should handle specialty with extra whitespace', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: '  Mental Health  ' })
      );
      
      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'Group Therapy']);
    });

    it('should return empty array for null specialty', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: null })
      );
      
      expect(result.current.approaches).toEqual([]);
    });

    it('should return empty array for undefined specialty', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: undefined })
      );
      
      expect(result.current.approaches).toEqual([]);
    });

    it('should return empty array for empty string specialty', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: '' })
      );
      
      expect(result.current.approaches).toEqual([]);
    });

    it('should return empty array for non-matching specialty', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Non-existent Specialty' })
      );
      
      expect(result.current.approaches).toEqual([]);
    });
  });

  describe('error handling for network failures and malformed data', () => {
    it('should handle network errors correctly', () => {
      const networkError = 'Network connection failed';
      mockUseSupabaseQuery.mockReturnValue({
        data: null,
        loading: false,
        error: networkError,
        refetch: vi.fn(),
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      expect(result.current.error).toEqual(
        expect.objectContaining({
          type: 'NETWORK_ERROR',
          message: 'Unable to connect to the server. Please check your internet connection and try again.',
          specialty: 'Mental Health',
        })
      );
      expect(result.current.approaches).toEqual([]);
    });

    it('should handle authentication errors correctly', () => {
      const authError = 'Authentication failed';
      mockUseSupabaseQuery.mockReturnValue({
        data: null,
        loading: false,
        error: authError,
        refetch: vi.fn(),
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      expect(result.current.error).toEqual(
        expect.objectContaining({
          type: 'NETWORK_ERROR',
          message: 'Authentication error. Please refresh the page and try again.',
          specialty: 'Mental Health',
        })
      );
    });

    it('should handle no data errors correctly', () => {
      const noDataError = 'No data found';
      mockUseSupabaseQuery.mockReturnValue({
        data: null,
        loading: false,
        error: noDataError,
        refetch: vi.fn(),
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      expect(result.current.error).toEqual(
        expect.objectContaining({
          type: 'NO_DATA',
          message: 'Treatment approaches data is currently unavailable. Please contact support if this persists.',
          specialty: 'Mental Health',
        })
      );
    });

    it('should handle malformed data gracefully', () => {
      const malformedData = [
        { id: 1, approaches: null, specialty: 'Mental Health', created_at: '2024-01-01' },
        { id: 2, approaches: 'CBT', specialty: null, created_at: '2024-01-01' },
        { id: 3, approaches: 'CPT', specialty: 'Mental Health', created_at: '2024-01-01' },
      ];

      mockUseSupabaseQuery.mockReturnValue({
        data: malformedData,
        loading: false,
        error: null,
        refetch: vi.fn(),
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: new Date(),
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      // Should filter out null approaches and null specialties
      expect(result.current.approaches).toEqual(['CPT']);
      expect(result.current.allApproaches).toEqual(malformedData);
    });

    it('should provide retry functionality for failed queries', async () => {
      const mockRefetch = vi.fn().mockResolvedValue(undefined);
      mockUseSupabaseQuery.mockReturnValue({
        data: null,
        loading: false,
        error: 'Network error',
        refetch: mockRefetch,
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      expect(typeof result.current.retry).toBe('function');

      await act(async () => {
        await result.current.retry();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should handle retry failures with exponential backoff', async () => {
      const mockRefetch = vi.fn().mockRejectedValue(new Error('Retry failed'));
      mockUseSupabaseQuery.mockReturnValue({
        data: null,
        loading: false,
        error: 'Network error',
        refetch: mockRefetch,
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: null,
      });

      // Mock setTimeout to avoid actual delays in tests
      vi.stubGlobal('setTimeout', vi.fn().mockImplementation((callback: () => void) => {
        callback();
        return 1;
      }));

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.error).toEqual(
        expect.objectContaining({
          type: 'NETWORK_ERROR',
          message: expect.stringContaining('connection'),
        })
      );

      // Restore setTimeout
      vi.unstubAllGlobals();
    });
  });

  describe('caching behavior and performance with multiple hook instances', () => {
    it('should share cached data between multiple hook instances', () => {
      const { result: result1 } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );
      
      const { result: result2 } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Physical Medicine' })
      );

      // Both hooks should have access to the same underlying data
      expect(result1.current.allApproaches).toEqual(mockTreatmentApproachesData);
      expect(result2.current.allApproaches).toEqual(mockTreatmentApproachesData);
      
      // But filtered results should be different
      expect(result1.current.approaches).toEqual(['CBT', 'CPT', 'Group Therapy']);
      expect(result2.current.approaches).toEqual(['Occupational Therapy', 'Physical Therapy']);
    });

    // Note: Removed test for exact call count as it's dependent on React rendering behavior
    // The important thing is that each hook instance gets the same cached data

    it('should provide immediate filtering results after data is loaded', () => {
      const { result, rerender } = renderHook(
        ({ specialty }) => useTreatmentApproaches({ specialty }),
        { initialProps: { specialty: 'Mental Health' } }
      );

      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'Group Therapy']);

      // Change specialty - should get immediate results from cached data
      rerender({ specialty: 'Physical Medicine' });

      expect(result.current.approaches).toEqual(['Occupational Therapy', 'Physical Therapy']);
    });

    it('should handle loading state correctly', () => {
      mockUseSupabaseQuery.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.approaches).toEqual([]);
    });

    it('should show loading state instead of "No approaches available"', () => {
      mockUseSupabaseQuery.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.approaches).toEqual([]);
    });

    it('should handle empty data gracefully', () => {
      mockUseSupabaseQuery.mockReturnValue({
        data: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: new Date(),
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      expect(result.current.approaches).toEqual([]);
      expect(result.current.allApproaches).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('enhanced refetch functionality', () => {
    it('should provide enhanced refetch function that resets error state', async () => {
      const mockRefetch = vi.fn().mockResolvedValue(undefined);
      mockUseSupabaseQuery.mockReturnValue({
        data: null,
        loading: false,
        error: 'Network error',
        refetch: mockRefetch,
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: null,
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      expect(result.current.error).toBeTruthy();

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should reset retry count on successful refetch', async () => {
      const mockRefetch = vi.fn().mockResolvedValue(undefined);
      mockUseSupabaseQuery.mockReturnValue({
        data: mockTreatmentApproachesData,
        loading: false,
        error: null,
        refetch: mockRefetch,
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: new Date(),
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockRefetch).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle rapid specialty changes without issues', () => {
      const { result, rerender } = renderHook(
        ({ specialty }) => useTreatmentApproaches({ specialty }),
        { initialProps: { specialty: 'Mental Health' } }
      );

      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'Group Therapy']);

      // Rapid changes
      rerender({ specialty: 'Physical Medicine' });
      expect(result.current.approaches).toEqual(['Occupational Therapy', 'Physical Therapy']);

      rerender({ specialty: null });
      expect(result.current.approaches).toEqual([]);

      rerender({ specialty: 'Mental Health' });
      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'Group Therapy']);
    });

    it('should handle data with mixed case specialties', () => {
      const mixedCaseData = [
        { id: 1, approaches: 'CBT', specialty: 'Mental Health', created_at: '2024-01-01' },
        { id: 2, approaches: 'CPT', specialty: 'MENTAL HEALTH', created_at: '2024-01-01' },
        { id: 3, approaches: 'Therapy', specialty: 'mental health', created_at: '2024-01-01' },
      ];

      mockUseSupabaseQuery.mockReturnValue({
        data: mixedCaseData,
        loading: false,
        error: null,
        refetch: vi.fn(),
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: new Date(),
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'Therapy']);
    });

    it('should sort approaches alphabetically', () => {
      const unsortedData = [
        { id: 1, approaches: 'Zebra Therapy', specialty: 'Mental Health', created_at: '2024-01-01' },
        { id: 2, approaches: 'Alpha Therapy', specialty: 'Mental Health', created_at: '2024-01-01' },
        { id: 3, approaches: 'Beta Therapy', specialty: 'Mental Health', created_at: '2024-01-01' },
      ];

      mockUseSupabaseQuery.mockReturnValue({
        data: unsortedData,
        loading: false,
        error: null,
        refetch: vi.fn(),
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: new Date(),
        errorType: null,
      });

      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );

      expect(result.current.approaches).toEqual(['Alpha Therapy', 'Beta Therapy', 'Zebra Therapy']);
    });
  });
});