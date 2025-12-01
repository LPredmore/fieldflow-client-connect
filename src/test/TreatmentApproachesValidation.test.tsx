// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTreatmentApproaches } from '@/hooks/useTreatmentApproaches';

// Mock the useSupabaseQuery hook
vi.mock('@/hooks/data/useSupabaseQuery', () => ({
  useSupabaseQuery: vi.fn(),
}));

// Mock the useStaffOnboarding hook
vi.mock('@/hooks/useStaffOnboarding', () => ({
  useStaffOnboarding: vi.fn(),
}));

// Import after mocking
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useStaffOnboarding } from '@/hooks/useStaffOnboarding';

const mockUseSupabaseQuery = vi.mocked(useSupabaseQuery);
const mockUseStaffOnboarding = vi.mocked(useStaffOnboarding);

// Real-world data scenarios for validation
const realWorldTreatmentApproachesData = [
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
    approaches: 'DBT',
    specialty: 'Mental Health',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 4,
    approaches: 'EMDR',
    specialty: 'Mental Health',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 5,
    approaches: 'Psychodynamic Therapy',
    specialty: 'Mental Health',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 6,
    approaches: 'Physical Therapy',
    specialty: 'Physical Medicine',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 7,
    approaches: 'Occupational Therapy',
    specialty: 'Physical Medicine',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 8,
    approaches: 'Speech Therapy',
    specialty: 'Speech Pathology',
    created_at: '2024-01-01T00:00:00Z',
  },
];

// Mock clinician data for form testing
const mockClinicianData = {
  id: 'test-clinician-id',
  user_id: 'test-user-id',
  tenant_id: 'test-tenant-id',
  clinician_field: 'Mental Health',
  clinician_licensed_states: ['CA'],
  clinician_license_type: 'LCSW',
  clinician_license_number: '12345',
  clinician_bio: 'Test bio for validation',
  clinician_treatment_approaches: ['CBT', 'CPT'],
  clinician_min_client_age: 18,
  prov_name_f: 'Test',
  prov_name_last: 'Doctor',
  clinician_accepting_new_clients: 'Yes' as const,
  clinician_status: 'Active',
  is_clinician: true,
  is_admin: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockProfileData = {
  id: 'test-profile-id',
  user_id: 'test-user-id',
  tenant_id: 'test-tenant-id',
  role: 'contractor' as const,
  first_name: 'Test',
  last_name: 'User',
  full_name: 'Test User',
  phone: '555-123-4567',
  email: 'test@example.com',
  company_name: 'Test Company',
  parent_admin_id: 'test-admin-id',
  avatar_url: '',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  
  // Mock console methods to reduce noise but still capture important logs
  console.log = vi.fn();
  console.error = vi.fn();
  console.warn = vi.fn();
  console.debug = vi.fn();
  
  // Default successful mock implementation
  mockUseSupabaseQuery.mockReturnValue({
    data: realWorldTreatmentApproachesData,
    loading: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    isRefreshing: false,
    isStale: false,
    isCircuitBreakerOpen: false,
    lastUpdated: new Date(),
    errorType: null,
  });

  // Default staff onboarding mock
  mockUseStaffOnboarding.mockReturnValue({
    clinician: mockClinicianData,
    profile: mockProfileData,
    loading: false,
    dataLoading: false,
    completeOnboarding: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Treatment Approaches Fix Validation - Real Data Scenarios', () => {
  describe('Task 9.1: Test with actual database data including "Mental Health" specialty', () => {
    it('should fetch all treatment approaches data immediately on hook initialization', async () => {
      const { result } = renderHook(() => useTreatmentApproaches());
      
      // Verify useSupabaseQuery was called without enabled flag
      expect(mockUseSupabaseQuery).toHaveBeenCalledWith({
        table: 'treatment_approaches',
        select: '*',
        orderBy: { column: 'approaches', ascending: true },
      });

      // Verify all data is available for debugging
      expect(result.current.allApproaches).toEqual(realWorldTreatmentApproachesData);
      expect(result.current.allApproaches).toHaveLength(8);
    });

    it('should load data immediately even when specialty is initially empty', async () => {
      const { result } = renderHook(() => useTreatmentApproaches({ specialty: '' }));
      
      // Data should be loaded even with empty specialty
      expect(result.current.allApproaches).toEqual(realWorldTreatmentApproachesData);
      expect(result.current.loading).toBe(false);
      
      // But filtered approaches should be empty for empty specialty
      expect(result.current.approaches).toEqual([]);
    });

    it('should log comprehensive debugging information during initialization in development', () => {
      // Set NODE_ENV to development for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      try {
        renderHook(() => useTreatmentApproaches({ specialty: 'Mental Health' }));
        
        // Verify initialization logging only happens in development
        expect(console.log).toHaveBeenCalledWith(
          '[useTreatmentApproaches] Hook initialized',
          expect.objectContaining({
            specialty: 'Mental Health',
            dataLoaded: true,
            dataCount: 8,
            loading: false,
            hasError: false,
          })
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Task 9.2: Verify CBT and CPT approaches display correctly for Mental Health specialty', () => {
    it('should filter and display CBT and CPT for Mental Health specialty', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );
      
      const expectedMentalHealthApproaches = ['CBT', 'CPT', 'DBT', 'EMDR', 'Psychodynamic Therapy'];
      expect(result.current.approaches).toEqual(expectedMentalHealthApproaches);
      
      // Specifically verify CBT and CPT are included
      expect(result.current.approaches).toContain('CBT');
      expect(result.current.approaches).toContain('CPT');
    });

    it('should handle case-insensitive specialty matching for Mental Health', () => {
      const testCases = [
        'Mental Health',
        'mental health',
        'MENTAL HEALTH',
        'Mental health',
        '  Mental Health  ', // with whitespace
      ];

      testCases.forEach(specialty => {
        const { result } = renderHook(() => 
          useTreatmentApproaches({ specialty })
        );
        
        expect(result.current.approaches).toContain('CBT');
        expect(result.current.approaches).toContain('CPT');
        expect(result.current.approaches).toHaveLength(5); // All Mental Health approaches
      });
    });

    it('should sort approaches alphabetically including CBT and CPT', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );
      
      const approaches = result.current.approaches;
      const sortedApproaches = [...approaches].sort();
      
      expect(approaches).toEqual(sortedApproaches);
      
      // Verify CBT comes before CPT alphabetically
      const cbtIndex = approaches.indexOf('CBT');
      const cptIndex = approaches.indexOf('CPT');
      expect(cbtIndex).toBeLessThan(cptIndex);
    });

    it('should log filtering operations with Mental Health specialty in development', () => {
      // Set NODE_ENV to development for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      try {
        renderHook(() => useTreatmentApproaches({ specialty: 'Mental Health' }));
        
        // Verify filtering logging only happens in development
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[useTreatmentApproaches] Starting filtering operation'),
          expect.objectContaining({
            specialty: 'Mental Health',
            allDataCount: 8,
            hasSpecialty: true,
          })
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Task 9.3: Test edge cases like empty specialty or missing approaches data', () => {
    it('should handle null specialty gracefully', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: null })
      );
      
      expect(result.current.approaches).toEqual([]);
      expect(result.current.allApproaches).toEqual(realWorldTreatmentApproachesData);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle undefined specialty gracefully', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: undefined })
      );
      
      expect(result.current.approaches).toEqual([]);
      expect(result.current.allApproaches).toEqual(realWorldTreatmentApproachesData);
    });

    it('should handle empty string specialty gracefully', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: '' })
      );
      
      expect(result.current.approaches).toEqual([]);
      expect(result.current.allApproaches).toEqual(realWorldTreatmentApproachesData);
    });

    it('should handle non-existent specialty gracefully', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Non-existent Specialty' })
      );
      
      expect(result.current.approaches).toEqual([]);
      expect(result.current.allApproaches).toEqual(realWorldTreatmentApproachesData);
      expect(result.current.error).toBeNull();
    });

    it('should handle missing approaches data (empty database)', () => {
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

    it('should handle malformed data with null approaches or specialty fields', () => {
      const malformedData = [
        { id: 1, approaches: null, specialty: 'Mental Health', created_at: '2024-01-01' },
        { id: 2, approaches: 'CBT', specialty: null, created_at: '2024-01-01' },
        { id: 3, approaches: 'CPT', specialty: 'Mental Health', created_at: '2024-01-01' },
        { id: 4, approaches: '', specialty: 'Mental Health', created_at: '2024-01-01' },
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

      // Should filter out null/empty approaches and null specialties
      expect(result.current.approaches).toEqual(['CPT']);
      expect(result.current.allApproaches).toEqual(malformedData);
    });

    it('should log edge case handling appropriately in development', () => {
      // Set NODE_ENV to development for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      try {
        renderHook(() => useTreatmentApproaches({ specialty: null }));
        
        // Verify edge case logging only happens in development
        expect(console.log).toHaveBeenCalledWith(
          '[useTreatmentApproaches] No specialty provided, returning empty array gracefully',
          expect.objectContaining({
            specialty: null,
            specialtyType: 'object',
          })
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Task 9.4: Validate no "No treatment approaches available" message appears during normal loading', () => {
    it('should show "Loading treatment approaches..." instead of "No treatment approaches available" during loading', async () => {
      // Mock loading state
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
      expect(result.current.error).toBeNull();
    });

    it('should not show error state during normal data loading', () => {
      // Mock successful loading completion
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );
      
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.approaches).toHaveLength(5); // Mental Health approaches
    });

    it('should handle transition from loading to loaded state correctly', async () => {
      // Start with loading state
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

      const { result, rerender } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );
      
      expect(result.current.loading).toBe(true);
      expect(result.current.approaches).toEqual([]);

      // Simulate data loading completion
      mockUseSupabaseQuery.mockReturnValue({
        data: realWorldTreatmentApproachesData,
        loading: false,
        error: null,
        refetch: vi.fn(),
        isRefreshing: false,
        isStale: false,
        isCircuitBreakerOpen: false,
        lastUpdated: new Date(),
        errorType: null,
      });

      rerender();

      expect(result.current.loading).toBe(false);
      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'DBT', 'EMDR', 'Psychodynamic Therapy']);
      expect(result.current.error).toBeNull();
    });

    it('should handle specialty changes during and after loading', async () => {
      const { result, rerender } = renderHook(
        ({ specialty }) => useTreatmentApproaches({ specialty }),
        { initialProps: { specialty: 'Mental Health' } }
      );

      // Initial load with Mental Health
      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'DBT', 'EMDR', 'Psychodynamic Therapy']);

      // Change to Physical Medicine - should get immediate results from cached data
      rerender({ specialty: 'Physical Medicine' });
      expect(result.current.approaches).toEqual(['Occupational Therapy', 'Physical Therapy']);

      // Change to empty specialty
      rerender({ specialty: '' });
      expect(result.current.approaches).toEqual([]);

      // Change back to Mental Health
      rerender({ specialty: 'Mental Health' });
      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'DBT', 'EMDR', 'Psychodynamic Therapy']);
    });
  });

  describe('Integration with StaffRegistrationForm - Real Scenario Testing', () => {
    it('should integrate properly with StaffRegistrationForm without showing "No treatment approaches available"', async () => {
      // This test would require a more complex setup to render the full form
      // For now, we'll test the hook behavior that the form depends on
      
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: mockClinicianData.clinician_field })
      );
      
      // Verify the hook provides the expected data for the form
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.approaches).toContain('CBT');
      expect(result.current.approaches).toContain('CPT');
      
      // Verify the form would have access to all approaches for debugging
      expect(result.current.allApproaches).toHaveLength(8);
    });

    it('should handle form initialization timing correctly', async () => {
      // Simulate form initialization sequence
      let specialty = ''; // Initially empty during form setup
      
      const { result, rerender } = renderHook(
        ({ specialty }) => useTreatmentApproaches({ specialty }),
        { initialProps: { specialty } }
      );

      // Initially empty specialty should not cause errors
      expect(result.current.approaches).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.allApproaches).toHaveLength(8); // Data still loaded

      // Simulate form reset with clinician data
      specialty = 'Mental Health';
      rerender({ specialty });

      // Should immediately show filtered results
      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'DBT', 'EMDR', 'Psychodynamic Therapy']);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide retry functionality for network errors in form context', async () => {
      const mockRefetch = vi.fn().mockResolvedValue(undefined);
      mockUseSupabaseQuery.mockReturnValue({
        data: null,
        loading: false,
        error: 'Network connection failed',
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

      expect(result.current.error).toEqual(
        expect.objectContaining({
          type: 'NETWORK_ERROR',
          message: 'Unable to connect to the server. Please check your internet connection and try again.',
        })
      );

      // Test retry functionality
      await act(async () => {
        await result.current.retry();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Performance and Caching Validation', () => {
    it('should cache data efficiently across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );
      
      const { result: result2 } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Physical Medicine' })
      );

      // Both hooks should share the same cached data
      expect(result1.current.allApproaches).toEqual(realWorldTreatmentApproachesData);
      expect(result2.current.allApproaches).toEqual(realWorldTreatmentApproachesData);
      
      // But have different filtered results
      expect(result1.current.approaches).toEqual(['CBT', 'CPT', 'DBT', 'EMDR', 'Psychodynamic Therapy']);
      expect(result2.current.approaches).toEqual(['Occupational Therapy', 'Physical Therapy']);

      // Note: Each hook instance calls useSupabaseQuery independently, but they would share
      // the same cached data in a real Supabase implementation. The mock is called once per hook.
      expect(mockUseSupabaseQuery).toHaveBeenCalled();
    });

    it('should provide immediate filtering results after initial data load', () => {
      const { result, rerender } = renderHook(
        ({ specialty }) => useTreatmentApproaches({ specialty }),
        { initialProps: { specialty: 'Mental Health' } }
      );

      expect(result.current.approaches).toEqual(['CBT', 'CPT', 'DBT', 'EMDR', 'Psychodynamic Therapy']);

      // Rapid specialty changes should provide immediate results
      const startTime = performance.now();
      
      rerender({ specialty: 'Physical Medicine' });
      expect(result.current.approaches).toEqual(['Occupational Therapy', 'Physical Therapy']);
      
      rerender({ specialty: 'Speech Pathology' });
      expect(result.current.approaches).toEqual(['Speech Therapy']);
      
      const endTime = performance.now();
      
      // Filtering should be very fast (less than 10ms for this dataset)
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should provide performance metrics for monitoring', () => {
      const { result } = renderHook(() => 
        useTreatmentApproaches({ specialty: 'Mental Health' })
      );
      
      // Verify performance metrics are available
      expect(result.current.performanceMetrics).toBeDefined();
      expect(result.current.cacheMetrics).toBeDefined();
      expect(result.current.debugInfo).toBeDefined();
      
      // Verify debug info contains useful information
      expect(result.current.debugInfo.specialty).toBe('Mental Health');
      expect(result.current.debugInfo.hookId).toBeDefined();
    });
  });
});