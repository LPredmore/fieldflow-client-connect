import { describe, it, expect } from 'vitest';
import { validateAgainstKnownIssues, KNOWN_REMOVED_COLUMNS, SchemaValidator } from '@/utils/schemaValidator';

describe('Basic Schema Validation Tests', () => {
  describe('validateAgainstKnownIssues', () => {
    it('should validate against known removed columns in appointment_series', async () => {
      const result = await validateAgainstKnownIssues('appointment_series', 'id, notes, title');
      
      expect(result.isValid).toBe(false);
      expect(result.invalidColumns).toContain('notes');
      expect(result.validColumns).toContain('id');
      expect(result.validColumns).toContain('title');
    });

    it('should pass validation when no removed columns are referenced', async () => {
      const result = await validateAgainstKnownIssues('appointment_series', 'id, title, description');
      
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

  describe('SchemaValidator.parseSelectString', () => {
    it('should parse simple column lists', () => {
      const result = SchemaValidator.parseSelectString('id, title, description');
      
      expect(result).toEqual([
        { table: 'main', columns: ['id', 'title', 'description'] }
      ]);
    });

    it('should handle wildcard selects', () => {
      const result = SchemaValidator.parseSelectString('*');
      
      expect(result).toEqual([
        { table: 'main', columns: ['*'] }
      ]);
    });

    it('should parse basic joins', () => {
      const result = SchemaValidator.parseSelectString('*, appointment_series!inner(title, description)');
      
      expect(result.length).toBeGreaterThan(0);
      const joinResult = result.find(r => r.table === 'appointment_series');
      expect(joinResult).toBeDefined();
      expect(joinResult?.columns).toContain('title');
      expect(joinResult?.columns).toContain('description');
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
  });
});