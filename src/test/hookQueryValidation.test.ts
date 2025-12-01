import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { validateAgainstKnownIssues, SchemaValidator } from '@/utils/schemaValidator';
import React from 'react';

// Mock the actual hooks to avoid complex setup
vi.mock('@/hooks/useUnifiedAppointments', () => ({
  useUnifiedAppointments: () => ({
    unifiedJobs: [],
    upcomingJobs: [],
    loading: false,
    error: null,
    refetchJobs: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
  }),
}));

vi.mock('@/hooks/data/useSupabaseQuery', () => ({
  useSupabaseQuery: vi.fn(() => ({
    data: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
    isRefreshing: false,
  })),
}));

describe('Hook Query Validation Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    SchemaValidator.clearCache();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  describe('useUnifiedAppointments Query Validation', () => {
    it('should validate that appointment_occurrences query does not reference removed columns', async () => {
      // This is the actual select string used in useUnifiedAppointments
      const selectString = `
        *,
        appointment_series!inner(
          title,
          description,
          service_id,
          services!fk_appointment_series_service(id, name, category, description)
        )
      `;

      // Parse the select string to extract column references
      const parsedSelects = SchemaValidator.parseSelectString(selectString);
      
      // Find appointment_series columns
      const appointmentSeriesSelect = parsedSelects.find(
        select => select.table === 'appointment_series'
      );
      
      expect(appointmentSeriesSelect).toBeDefined();
      
      if (appointmentSeriesSelect) {
        // Validate against known removed columns
        const result = await validateAgainstKnownIssues(
          'appointment_series',
          appointmentSeriesSelect.columns.join(', ')
        );
        
        expect(result.isValid).toBe(true);
        expect(result.invalidColumns).toEqual([]);
        
        // Specifically check that 'notes' is not referenced
        expect(appointmentSeriesSelect.columns).not.toContain('notes');
        expect(appointmentSeriesSelect.columns).not.toContain('estimated_cost');
      }
    });

    it('should fail validation if notes column is referenced', async () => {
      // Test what would happen if the problematic query was still in use
      const problematicSelectString = `
        *,
        appointment_series!inner(
          title,
          description,
          notes,
          service_id
        )
      `;

      const parsedSelects = SchemaValidator.parseSelectString(problematicSelectString);
      const appointmentSeriesSelect = parsedSelects.find(
        select => select.table === 'appointment_series'
      );
      
      if (appointmentSeriesSelect) {
        const result = await validateAgainstKnownIssues(
          'appointment_series',
          appointmentSeriesSelect.columns.join(', ')
        );
        
        expect(result.isValid).toBe(false);
        expect(result.invalidColumns).toContain('notes');
      }
    });
  });

  describe('Query Pattern Validation', () => {
    it('should validate common appointment_series query patterns', async () => {
      const commonPatterns = [
        'id, title, description, service_id',
        'id, title, description, created_at, tenant_id',
        'id, title, service_id, is_recurring',
      ];

      for (const pattern of commonPatterns) {
        const result = await validateAgainstKnownIssues('appointment_series', pattern);
        expect(result.isValid).toBe(true);
        expect(result.invalidColumns).toEqual([]);
      }
    });

    it('should validate common appointment_occurrences query patterns', async () => {
      const commonPatterns = [
        'id, series_id, start_at, end_at, status',
        'id, customer_id, status, priority, actual_cost',
        'id, assigned_to_user_id, completion_notes',
      ];

      for (const pattern of commonPatterns) {
        const result = await validateAgainstKnownIssues('appointment_occurrences', pattern);
        expect(result.isValid).toBe(true);
        expect(result.invalidColumns).toEqual([]);
      }
    });

    it('should detect problematic patterns in appointment_occurrences', async () => {
      const problematicPatterns = [
        'id, override_estimated_cost, status',
        'override_estimated_cost, actual_cost',
      ];

      for (const pattern of problematicPatterns) {
        const result = await validateAgainstKnownIssues('appointment_occurrences', pattern);
        expect(result.isValid).toBe(false);
        expect(result.invalidColumns).toContain('override_estimated_cost');
      }
    });
  });

  describe('Migration Impact Validation', () => {
    it('should identify all potential issues from recent schema changes', async () => {
      // Test impact of all known removed columns
      const appointmentSeriesImpact = await SchemaValidator.analyzeMigrationImpact(
        'appointment_series',
        ['notes', 'estimated_cost']
      );

      expect(appointmentSeriesImpact.potentialIssues).toHaveLength(2);
      expect(appointmentSeriesImpact.affectedQueries).toHaveLength(2);
      expect(appointmentSeriesImpact.recommendations).toHaveLength(2);

      const appointmentOccurrencesImpact = await SchemaValidator.analyzeMigrationImpact(
        'appointment_occurrences',
        ['override_estimated_cost']
      );

      expect(appointmentOccurrencesImpact.potentialIssues).toHaveLength(1);
      expect(appointmentOccurrencesImpact.affectedQueries).toHaveLength(1);
      expect(appointmentOccurrencesImpact.recommendations).toHaveLength(1);
    });
  });

  describe('Real-world Query Scenarios', () => {
    it('should validate dashboard data loading queries', async () => {
      // Simulate the queries that would be used in dashboard components
      const dashboardQueries = [
        {
          table: 'appointment_series',
          select: 'id, title, description, service_id, created_at',
          filters: { is_recurring: false, tenant_id: 'auto' },
        },
        {
          table: 'appointment_occurrences',
          select: '*, appointment_series!inner(title, description, service_id)',
          filters: { tenant_id: 'auto' },
        },
      ];

      for (const query of dashboardQueries) {
        const results = await SchemaValidator.validateQuery(query.table, query.select);
        
        // All queries should be valid
        for (const result of results) {
          expect(result.isValid).toBe(true);
          expect(result.invalidColumns).toEqual([]);
        }
      }
    });

    it('should validate service management queries', async () => {
      // Test queries that might be used in service-related components
      const serviceQueries = [
        'id, name, category, description',
        'id, name, category, description, created_at, tenant_id',
      ];

      for (const query of serviceQueries) {
        // Note: We're testing against appointment_series since our mock doesn't have services table
        // In a real implementation, this would test against the actual services table
        const result = await validateAgainstKnownIssues('services', query);
        expect(result.isValid).toBe(true); // Should pass since services table has no known removed columns
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty select strings gracefully', async () => {
      const result = await validateAgainstKnownIssues('appointment_series', '');
      expect(result.isValid).toBe(true);
      expect(result.invalidColumns).toEqual([]);
    });

    it('should handle wildcard selects', async () => {
      const result = await validateAgainstKnownIssues('appointment_series', '*');
      expect(result.isValid).toBe(true);
      expect(result.validColumns).toEqual(['*']);
    });

    it('should handle complex nested selects', async () => {
      const complexSelect = `
        *,
        appointment_series!inner(
          title,
          description,
          services!fk_appointment_series_service(
            id,
            name,
            category
          )
        )
      `;

      const parsedSelects = SchemaValidator.parseSelectString(complexSelect);
      expect(parsedSelects.length).toBeGreaterThan(0);
      
      // Should not throw errors when parsing
      expect(() => SchemaValidator.parseSelectString(complexSelect)).not.toThrow();
    });
  });
});