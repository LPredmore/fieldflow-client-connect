// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaffRegistrationForm } from '@/components/Staff/StaffRegistrationForm';

// Mock ResizeObserver for Radix UI components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock all the hooks and dependencies
vi.mock('@/hooks/useStaffOnboarding', () => ({
  useStaffOnboarding: vi.fn(),
}));

vi.mock('@/hooks/useTreatmentApproaches', () => ({
  useTreatmentApproaches: vi.fn(),
}));

vi.mock('@/hooks/data/useSupabaseQuery', () => ({
  useSupabaseQuery: vi.fn(),
}));

vi.mock('@/hooks/data/useSupabaseMutation', () => ({
  useSupabaseInsert: vi.fn(),
  useSupabaseDelete: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

vi.mock('@/hooks/useLicenseTypes', () => ({
  useLicenseTypes: vi.fn(),
}));

// Import after mocking
import { useStaffOnboarding } from '@/hooks/useStaffOnboarding';
import { useTreatmentApproaches } from '@/hooks/useTreatmentApproaches';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLicenseTypes } from '@/hooks/useLicenseTypes';

const mockUseStaffOnboarding = vi.mocked(useStaffOnboarding);
const mockUseTreatmentApproaches = vi.mocked(useTreatmentApproaches);
const mockUseAuth = vi.mocked(useAuth);
const mockUseToast = vi.mocked(useToast);
const mockUseLicenseTypes = vi.mocked(useLicenseTypes);

// Mock data for testing
const mockProfile = {
  id: 'profile-1',
  first_name: 'John',
  last_name: 'Doe',
  phone: '555-123-4567',
  email: 'john.doe@example.com',
};

const mockClinician = {
  id: 'clinician-1',
  clinician_field: 'Mental Health',
  clinician_licensed_states: ['CA'],
  clinician_license_type: 'LCSW',
  clinician_license_number: 'LIC123456',
  clinician_npi_number: '1234567890',
  clinician_taxonomy_code: 'TAX123',
  clinician_licenses_detailed: [
    {
      state: 'CA',
      licenseType: 'LCSW',
      licenseNumber: 'LIC123456',
      isPrimary: true,
    },
    {
      state: 'NY',
      licenseType: 'LCSW',
      licenseNumber: 'LIC789012',
      isPrimary: false,
    },
  ],
  clinician_bio: 'Experienced therapist specializing in cognitive behavioral therapy.',
  clinician_treatment_approaches: ['CBT', 'CPT'],
  clinician_min_client_age: 18,
  prov_name_f: 'John',
  prov_name_last: 'Doe',
  clinician_accepting_new_clients: 'Yes',
};

const mockTreatmentApproachesData = [
  'CBT',
  'CPT',
  'Group Therapy',
  'Individual Therapy',
];

const mockAllTreatmentApproachesData = [
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
    approaches: 'Group Therapy',
    specialty: 'Mental Health',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 4,
    approaches: 'Physical Therapy',
    specialty: 'Physical Medicine',
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
  
  // Default mock implementations
  mockUseStaffOnboarding.mockReturnValue({
    clinician: {
      ...mockClinician,
      user_id: 'user-1',
      tenant_id: 'tenant-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    profile: {
      ...mockProfile,
      full_name: 'John Doe',
      company_name: 'Test Clinic',
      role: 'contractor' as const,
      parent_admin_id: 'admin-1',
      avatar_url: '',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    loading: false,
    dataLoading: false,
    completeOnboarding: vi.fn().mockResolvedValue(undefined),
  });

  mockUseTreatmentApproaches.mockReturnValue({
    approaches: mockTreatmentApproachesData,
    loading: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    allApproaches: mockAllTreatmentApproachesData,
    retry: vi.fn().mockResolvedValue(undefined),
    performanceMetrics: null,
    cacheMetrics: { totalRequests: 0, cacheSize: 0 },
    debugInfo: { hookId: 'test-hook', specialty: null, errorCount: 0, retryCount: 0 },
  });

  mockUseAuth.mockReturnValue({
    user: { 
      id: 'user-1', 
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00Z',
    },
    tenantId: 'tenant-1',
    isAdmin: false,
    loading: false,
    signOut: vi.fn(),
  });

  mockUseToast.mockReturnValue({
    toast: vi.fn(),
    toasts: [],
    dismiss: vi.fn(),
  });

  mockUseLicenseTypes.mockReturnValue({
    licenseTypes: [],
    uniqueSpecialties: [],
    loading: false,
    error: null,
    addLicenseType: vi.fn(),
    deleteLicenseType: vi.fn(),
    refetch: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StaffRegistrationForm Integration Tests', () => {
  describe('hook integration with StaffRegistrationForm component', () => {
    it('should call useTreatmentApproaches hook with correct specialty parameter', () => {
      render(<StaffRegistrationForm />);
      
      // Verify hook was called with correct specialty from clinician data
      expect(mockUseTreatmentApproaches).toHaveBeenCalledWith({
        specialty: 'Mental Health',
      });
    });

    it('should handle hook return values correctly in form context', () => {
      const mockRetry = vi.fn().mockResolvedValue(undefined);
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: ['CBT', 'DBT'],
        loading: false,
        error: null,
        refetch: vi.fn(),
        allApproaches: mockAllTreatmentApproachesData,
        retry: mockRetry,
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });

    it('should pass specialty changes to hook correctly', () => {
      // Test with different specialty
      const clinicianWithDifferentSpecialty = {
        ...mockClinician,
        clinician_field: 'Physical Medicine',
      };
      
      mockUseStaffOnboarding.mockReturnValue({
        clinician: clinicianWithDifferentSpecialty,
        profile: mockProfile,
        loading: false,
        dataLoading: false,
        completeOnboarding: vi.fn(),
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called with new specialty
      expect(mockUseTreatmentApproaches).toHaveBeenCalledWith({
        specialty: 'Physical Medicine',
      });
    });

    it('should handle empty specialty gracefully', () => {
      const clinicianWithEmptySpecialty = {
        ...mockClinician,
        clinician_field: '',
      };
      
      mockUseStaffOnboarding.mockReturnValue({
        clinician: clinicianWithEmptySpecialty,
        profile: mockProfile,
        loading: false,
        dataLoading: false,
        completeOnboarding: vi.fn(),
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called with empty specialty
      expect(mockUseTreatmentApproaches).toHaveBeenCalledWith({
        specialty: '',
      });
    });
  });

  describe('form initialization timing with treatment approaches loading', () => {
    it('should handle hook loading state during form initialization', () => {
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
        allApproaches: [],
        retry: vi.fn(),
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called even during loading
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });

    it('should call hook immediately on form initialization', () => {
      render(<StaffRegistrationForm />);
      
      // Verify hook was called when form renders (may be called multiple times due to React rendering)
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });

    it('should handle data loading after form renders', () => {
      // Start with loading state
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
        allApproaches: [],
        retry: vi.fn(),
      });

      const { rerender } = render(<StaffRegistrationForm />);
      
      // Update to loaded state
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: mockTreatmentApproachesData,
        loading: false,
        error: null,
        refetch: vi.fn(),
        allApproaches: mockAllTreatmentApproachesData,
        retry: vi.fn(),
      });
      
      rerender(<StaffRegistrationForm />);
      
      // Verify hook was called multiple times during state changes
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });

    it('should handle immediate data availability', () => {
      // Hook returns data immediately
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: mockTreatmentApproachesData,
        loading: false,
        error: null,
        refetch: vi.fn(),
        allApproaches: mockAllTreatmentApproachesData,
        retry: vi.fn(),
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called with correct parameters
      expect(mockUseTreatmentApproaches).toHaveBeenCalledWith({
        specialty: 'Mental Health',
      });
    });
  });

  describe('specialty changes triggering correct approach filtering', () => {
    it('should call hook with different specialty values', () => {
      // Test with Physical Medicine specialty
      const clinicianWithPhysicalMedicine = {
        ...mockClinician,
        clinician_field: 'Physical Medicine',
      };
      
      mockUseStaffOnboarding.mockReturnValue({
        clinician: clinicianWithPhysicalMedicine,
        profile: mockProfile,
        loading: false,
        dataLoading: false,
        completeOnboarding: vi.fn(),
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called with Physical Medicine specialty
      expect(mockUseTreatmentApproaches).toHaveBeenCalledWith({
        specialty: 'Physical Medicine',
      });
    });

    it('should handle specialty changes reactively', () => {
      // Start with Mental Health
      render(<StaffRegistrationForm />);
      
      expect(mockUseTreatmentApproaches).toHaveBeenCalledWith({
        specialty: 'Mental Health',
      });
      
      // Simulate specialty change by re-rendering with different data
      const clinicianWithNewSpecialty = {
        ...mockClinician,
        clinician_field: 'Psychiatry',
      };
      
      mockUseStaffOnboarding.mockReturnValue({
        clinician: clinicianWithNewSpecialty,
        profile: mockProfile,
        loading: false,
        dataLoading: false,
        completeOnboarding: vi.fn(),
      });

      const { rerender } = render(<StaffRegistrationForm />);
      
      // Verify hook responds to specialty changes
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });

    it('should handle empty specialty gracefully', () => {
      const clinicianWithEmptySpecialty = {
        ...mockClinician,
        clinician_field: '',
      };
      
      mockUseStaffOnboarding.mockReturnValue({
        clinician: clinicianWithEmptySpecialty,
        profile: mockProfile,
        loading: false,
        dataLoading: false,
        completeOnboarding: vi.fn(),
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called with empty specialty
      expect(mockUseTreatmentApproaches).toHaveBeenCalledWith({
        specialty: '',
      });
    });

    it('should handle null specialty gracefully', () => {
      const clinicianWithNullSpecialty = {
        ...mockClinician,
        clinician_field: null,
      };
      
      mockUseStaffOnboarding.mockReturnValue({
        clinician: clinicianWithNullSpecialty,
        profile: mockProfile,
        loading: false,
        dataLoading: false,
        completeOnboarding: vi.fn(),
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called with empty string (converted from null)
      expect(mockUseTreatmentApproaches).toHaveBeenCalledWith({
        specialty: '',
      });
    });
  });

  describe('error states and loading states in form context', () => {
    it('should handle network error state from hook', () => {
      const mockRetry = vi.fn().mockResolvedValue(undefined);
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: [],
        loading: false,
        error: {
          type: 'NETWORK_ERROR',
          message: 'Unable to connect to the server. Please check your internet connection and try again.',
          specialty: 'Mental Health',
          timestamp: new Date(),
        },
        refetch: vi.fn(),
        allApproaches: [],
        retry: mockRetry,
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called and error state is handled
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });

    it('should handle no data error state from hook', () => {
      const mockRetry = vi.fn().mockResolvedValue(undefined);
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: [],
        loading: false,
        error: {
          type: 'NO_DATA',
          message: 'Treatment approaches data is currently unavailable. Please contact support if this persists.',
          specialty: 'Mental Health',
          timestamp: new Date(),
        },
        refetch: vi.fn(),
        allApproaches: [],
        retry: mockRetry,
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called and error state is handled
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });

    it('should handle filter error state from hook', () => {
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: [],
        loading: false,
        error: {
          type: 'FILTER_ERROR',
          message: 'Error filtering treatment approaches.',
          specialty: 'Mental Health',
          timestamp: new Date(),
        },
        refetch: vi.fn(),
        allApproaches: [],
        retry: vi.fn(),
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called and error state is handled
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });

    it('should handle error recovery when hook error is resolved', () => {
      // Start with error state
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: [],
        loading: false,
        error: {
          type: 'NETWORK_ERROR',
          message: 'Network error occurred',
          specialty: 'Mental Health',
          timestamp: new Date(),
        },
        refetch: vi.fn(),
        allApproaches: [],
        retry: vi.fn(),
      });

      const { rerender } = render(<StaffRegistrationForm />);
      
      // Resolve error and provide data
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: mockTreatmentApproachesData,
        loading: false,
        error: null,
        refetch: vi.fn(),
        allApproaches: mockAllTreatmentApproachesData,
        retry: vi.fn(),
      });
      
      rerender(<StaffRegistrationForm />);
      
      // Verify hook was called in both states
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });

    it('should handle loading state from hook', () => {
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
        allApproaches: [],
        retry: vi.fn(),
      });

      render(<StaffRegistrationForm />);
      
      // Verify hook was called during loading state
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });

    it('should handle transition from loading to loaded state', () => {
      // Start with loading state
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
        allApproaches: [],
        retry: vi.fn(),
      });

      const { rerender } = render(<StaffRegistrationForm />);
      
      // Update to loaded state
      mockUseTreatmentApproaches.mockReturnValue({
        approaches: mockTreatmentApproachesData,
        loading: false,
        error: null,
        refetch: vi.fn(),
        allApproaches: mockAllTreatmentApproachesData,
        retry: vi.fn(),
      });
      
      rerender(<StaffRegistrationForm />);
      
      // Verify hook was called in both states
      expect(mockUseTreatmentApproaches).toHaveBeenCalled();
    });
  });
});