import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchemaValidator, validateAgainstKnownIssues, KNOWN_REMOVED_COLUMNS } from '@/utils/schemaValidator';

// Mock the supabase client for testing
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: [
              { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
              { column_name: 'title', data_type: 'text', is_nullable: 'YES', column_default: null },
              { column_name: 'description', data_type: 'text', is_nullable: 'YES', column_default: null },
              { column_name: 'service_id', data_type: 'uuid', is_nullable: 'YES', column_default: null },
              { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
            ],
            error: null,
          })),
        })),
      })),
    })),
  },
}));

describe('Schema Validation Tests', () => {
  beforeEach(() => {
    SchemaValidator.clearCache();
  });

  describe('SchemaValidator.getTableSchema', () => {
    it('should fetch and cache table schema', async () => {
      const schema = await SchemaValidator.getTableSchema('appointment_series');
      
      expect(schema).toHaveLength(5);
      expect(schema[0]).toEqual({
        column_name: 'id',
        data_type: 'uuid',
        is_nullable: 'NO',
        column_default: null,
      });
    });

    it('should return cached schema on subsequent calls', async () => {
      const schema1 = await SchemaValidator.getTableSchema('appointment_series');
      const schema2 = await SchemaValidator.getTableSchema('appointment_series');
      
      expect(schema1).toBe(schema2); // Should be the same reference (cached)
    });
  });

  describe('SchemaValidator.getValidColumns', () => {
    it('should return array of valid column names', async () => {
      const columns = await SchemaValidator.getValidColumns('appointment_series');
      
      expect(columns).toEqual(['id', 'title', 'description', 'service_id', 'created_at']);
    });
  });

  describe('SchemaValidator.validateColumns', () => {
    it('should validate existing columns as valid', async () => {
      const result = await SchemaValidator.validateColumns('appointment_series', ['id', 'title', 'description']);
      
      expect(result.isValid).toBe(true);
      expect(result.invalidColumns).toEqual([]);
      expect(result.validColumns).toEqual(['id', 'title', 'description']);
      expect(result.tableName).toBe('appointment_series');
    });

    it('should identify non-existent columns as invalid', async () => {
      const result = await SchemaValidator.validateColumns('appointment_series', ['id', 'notes', 'estimated_cost']);
      
      expect(result.isValid).toBe(false);
      expect(result.invalidColumns).toEqual(['notes', 'estimated_cost']);
      expect(result.validColumns).toEqual(['id']);
      expect(result.tableName).toBe('appointment_series');
    });

    it('should handle mixed valid and invalid columns', async () => {
      const result = await SchemaValidator.validateColumns('appointment_series', ['title', 'invalid_column', 'description']);
      
      expect(result.isValid).toBe(false);
      expect(result.invalidColumns).toEqual(['invalid_column']);
      expect(result.validColumns).toEqual(['title', 'description']);
    });
  });

  describe('SchemaValidator.parseSelectString', () => {
    it('should parse simple column lists', () => {
      const result = SchemaValidator.parseSelectString('id, title, description');
      
      expect(result).toEqual([
        { table: 'main', columns: ['id', 'title', 'description'] }
      ]);
    });

    it('should parse complex selects with joins', () => {
      const selectString = `
        *,
        appointment_series!inner(
          title,
          description,
          service_id,
          services!fk_appointment_series_service(id, name, category, description)
        )
      `;
      
      const result = SchemaValidator.parseSelectString(selectString);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        table: 'appointment_series',
        columns: ['title', 'description', 'service_id', 'services!fk_appointment_series_service(id, name, category, description)']
      });
    });

    it('should handle wildcard selects', () => {
      const result = SchemaValidator.parseSelectString('*');
      
      expect(result).toEqual([
        { table: 'main', columns: ['*'] }
      ]);
    });
  });

  describe('SchemaValidator.validateQuery', () => {
    it('should validate a complete query structure', async () => {
      const results = await SchemaValidator.validateQuery('appointment_series', 'id, title, description');
      
      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(true);
      expect(results[0].tableName).toBe('appointment_series');
    });

    it('should identify invalid columns in query', async () => {
      const results = await SchemaValidator.validateQuery('appointment_series', 'id, notes, title');
      
      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(false);
      expect(results[0].invalidColumns).toEqual(['notes']);
    });

    it('should handle wildcard queries as valid', async () => {
      const results = await SchemaValidator.validateQuery('appointment_series', '*');
      
      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(true);
      expect(results[0].validColumns).toEqual(['*']);
    });
  });

  describe('SchemaValidator.analyzeMigrationImpact', () => {
    it('should analyze impact of removed columns', async () => {
      const result = await SchemaValidator.analyzeMigrationImpact(
        'appointment_series',
        ['notes', 'estimated_cost'],
        ['new_column']
      );
      
      expect(result.potentialIssues).toHaveLength(2);
      expect(result.potentialIssues[0]).toContain("Column 'notes' removed");
      expect(result.potentialIssues[1]).toContain("Column 'estimated_cost' removed");
      
      expect(result.affectedQueries).toHaveLength(2);
      expect(result.recommendations).toHaveLength(3); // 2 for removed + 1 for added
    });
  });

  describe('validateAgainstKnownIssues', () => {
    it('should validate against known removed columns', async () => {
      const result = await validateAgainstKnownIssues('appointment_series', 'id, notes, title');
      
      expect(result.isValid).toBe(false);
      expect(result.invalidColumns).toEqual(['notes']);
      expect(result.validColumns).toEqual(['id', 'title']);
    });

    it('should pass validation when no removed columns are referenced', async () => {
      const result = await validateAgainstKnownIssues('appointment_series', 'id, title, description');
      
      expect(result.isValid).toBe(true);
      expect(result.invalidColumns).toEqual([]);
    });

    it('should handle tables with no known removed columns', async () => {
      const result = await validateAgainstKnownIssues('unknown_table', 'id, any_column');
      
      expect(result.isValid).toBe(true);
      expect(result.invalidColumns).toEqual([]);
    });
  });

  describe('KNOWN_REMOVED_COLUMNS configuration', () => {
    it('should contain known problematic columns', () => {
      expect(KNOWN_REMOVED_COLUMNS.appointment_series).toContain('notes');
      expect(KNOWN_REMOVED_COLUMNS.appointment_series).toContain('estimated_cost');
      expect(KNOWN_REMOVED_COLUMNS.appointment_occurrences).toContain('override_estimated_cost');
    });
  });
});