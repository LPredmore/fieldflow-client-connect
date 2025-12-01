import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchemaValidator, validateAgainstKnownIssues } from '@/utils/schemaValidator';

// Mock the supabase client with realistic schema data
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((tableName: string) => {
      const mockSchemas = {
        'information_schema.columns': {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => {
                  // Return different schemas based on table name in the filters
                  const appointmentSeriesSchema = [
                    { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
                    { column_name: 'title', data_type: 'text', is_nullable: 'YES', column_default: null },
                    { column_name: 'description', data_type: 'text', is_nullable: 'YES', column_default: null },
                    { column_name: 'service_id', data_type: 'uuid', is_nullable: 'YES', column_default: null },
                    { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
                    { column_name: 'tenant_id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
                    { column_name: 'is_recurring', data_type: 'boolean', is_nullable: 'NO', column_default: 'false' },
                  ];
                  
                  const appointmentOccurrencesSchema = [
                    { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
                    { column_name: 'series_id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
                    { column_name: 'start_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: null },
                    { column_name: 'end_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: null },
                    { column_name: 'status', data_type: 'text', is_nullable: 'NO', column_default: 'scheduled' },
                    { column_name: 'customer_id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
                    { column_name: 'tenant_id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
                    { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
                    { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
                    { column_name: 'priority', data_type: 'text', is_nullable: 'NO', column_default: 'medium' },
                    { column_name: 'assigned_to_user_id', data_type: 'uuid', is_nullable: 'YES', column_default: null },
                    { column_name: 'actual_cost', data_type: 'numeric', is_nullable: 'YES', column_default: null },
                    { column_name: 'completion_notes', data_type: 'text', is_nullable: 'YES', column_default: null },
                    { column_name: 'customer_name', data_type: 'text', is_nullable: 'YES', column_default: null },
                    { column_name: 'override_title', data_type: 'text', is_nullable: 'YES', column_default: null },
                    { column_name: 'override_description', data_type: 'text', is_nullable: 'YES', column_default: null },
                  ];

                  // This is a simplified mock - in reality we'd need to track which table is being queried
                  // For now, return appointment_series schema by default
                  return Promise.resolve({
                    data: appointmentSeriesSchema,
                    error: null,
                  });
                }),
              })),
            })),
          })),
        },
      };

      return mockSchemas[tableName as keyof typeof mockSchemas] || {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      };
    }),
  },
}));

describe('Database Query Validation Tests', () => {
  beforeEach(() => {
    SchemaValidator.clearCache();
  });

  describe('useUnifiedAppointments Query Validation', () => {
    it('should validate appointment_occurrences query structure', async () => {
      const selectString = `
        *,
        appointment_series!inner(
          title,
          description,
          service_id,
          services!fk_appointment_series_service(id, name, category, description)
        )
      `;

      const results = await SchemaValidator.validateQuery('appointment_occurrences', selectString);
      
      // Should have results for both main table and joined table
      expect(results.length).toBeGreaterThan(0);
      
      // Check that the main query is valid (wildcard should always be valid)
      const mainResult = results.find(r => r.tableName === 'appointment_occurrences');
      expect(mainResult?.isValid).toBe(true);
    });

    it('should detect removed columns in appointment_series queries', async () => {
      const selectString = `
        *,
        appointment_series!inner(
          title,
          description,
          notes,
          service_id
        )
      `;

      // Test against known removed columns
      const result = await validateAgainstKnownIssues('appointment_series', 'title, description, notes, service_id');
      
      expect(result.isValid).toBe(false);
      expect(result.invalidColumns).toContain('notes');
    });

    it('should validate corrected appointment_series query without removed columns', async () => {
      const selectString = `
        *,
        appointment_series!inner(
          title,
          description,
          service_id,
          services!fk_appointment_series_service(id, name, category, description)
        )
      `;

      // Test against known removed columns
      const result = await validateAgainstKnownIssues('appointment_series', 'title, description, service_id');
      
      expect(result.isValid).toBe(true);
      expect(result.invalidColumns).toEqual([]);
    });
  });

  describe('Common Query Patterns Validation', () => {
    it('should validate simple select queries', async () => {
      const result = await validateAgainstKnownIssues('appointment_series', 'id, title, description, service_id');
      
      expect(result.isValid).toBe(true);
      expect(result.invalidColumns).toEqual([]);
    });

    it('should detect problematic estimated_cost references', async () => {
      const result = await validateAgainstKnownIssues('appointment_series', 'id, title, estimated_cost');
      
      expect(result.isValid).toBe(false);
      expect(result.invalidColumns).toContain('estimated_cost');
    });

    it('should detect problematic override_estimated_cost references', async () => {
      const result = await validateAgainstKnownIssues('appointment_occurrences', 'id, status, override_estimated_cost');
      
      expect(result.isValid).toBe(false);
      expect(result.invalidColumns).toContain('override_estimated_cost');
    });
  });

  describe('Migration Impact Analysis', () => {
    it('should analyze impact of removing notes column', async () => {
      const impact = await SchemaValidator.analyzeMigrationImpact(
        'appointment_series',
        ['notes']
      );

      expect(impact.potentialIssues).toContain("Column 'notes' removed from table 'appointment_series'");
      expect(impact.affectedQueries).toContain("SELECT queries referencing 'appointment_series.notes'");
      expect(impact.recommendations).toContain("Update all queries that reference 'appointment_series.notes' to use alternative columns or remove the reference");
    });

    it('should analyze impact of removing estimated_cost column', async () => {
      const impact = await SchemaValidator.analyzeMigrationImpact(
        'appointment_series',
        ['estimated_cost']
      );

      expect(impact.potentialIssues).toContain("Column 'estimated_cost' removed from table 'appointment_series'");
      expect(impact.affectedQueries).toContain("SELECT queries referencing 'appointment_series.estimated_cost'");
    });

    it('should analyze impact of removing override_estimated_cost column', async () => {
      const impact = await SchemaValidator.analyzeMigrationImpact(
        'appointment_occurrences',
        ['override_estimated_cost']
      );

      expect(impact.potentialIssues).toContain("Column 'override_estimated_cost' removed from table 'appointment_occurrences'");
      expect(impact.affectedQueries).toContain("SELECT queries referencing 'appointment_occurrences.override_estimated_cost'");
    });
  });

  describe('Query Structure Logging', () => {
    it('should log query structure without errors', () => {
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const consoleEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      SchemaValidator.logQueryStructure(
        'appointment_occurrences',
        '*, appointment_series!inner(title, description)',
        { tenant_id: 'auto' }
      );

      expect(consoleSpy).toHaveBeenCalledWith('🔍 Query Structure Analysis - appointment_occurrences');
      expect(consoleLogSpy).toHaveBeenCalledWith('Table:', 'appointment_occurrences');
      expect(consoleEndSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      consoleEndSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('Schema Cache Management', () => {
    it('should clear cache when requested', async () => {
      // First call to populate cache
      await SchemaValidator.getTableSchema('appointment_series');
      
      // Clear cache
      SchemaValidator.clearCache();
      
      // This should work without issues
      const schema = await SchemaValidator.getTableSchema('appointment_series');
      expect(schema).toBeDefined();
    });
  });
});