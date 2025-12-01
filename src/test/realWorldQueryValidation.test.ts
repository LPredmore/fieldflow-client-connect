import { describe, it, expect } from 'vitest';
import { validateAgainstKnownIssues, SchemaValidator } from '@/utils/schemaValidator';

describe('Real-World Query Validation Tests', () => {
  describe('useUnifiedAppointments Query Validation', () => {
    it('should validate the current appointment_occurrences query structure', async () => {
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
        
        // Check that valid columns are present
        expect(appointmentSeriesSelect.columns).toContain('title');
        expect(appointmentSeriesSelect.columns).toContain('description');
        expect(appointmentSeriesSelect.columns).toContain('service_id');
      }
    });

    it('should fail validation if problematic query was still in use', async () => {
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

  describe('Common Query Patterns Validation', () => {
    it('should validate safe appointment_series query patterns', async () => {
      const safePatterns = [
        'id, title, description, service_id',
        'id, title, description, created_at, tenant_id',
        'id, title, service_id, is_recurring',
        'title, description, service_id', // Current pattern in useUnifiedAppointments
      ];

      for (const pattern of safePatterns) {
        const result = await validateAgainstKnownIssues('appointment_series', pattern);
        expect(result.isValid).toBe(true);
        expect(result.invalidColumns).toEqual([]);
      }
    });

    it('should validate safe appointment_occurrences query patterns', async () => {
      const safePatterns = [
        'id, series_id, start_at, end_at, status',
        'id, customer_id, status, priority, actual_cost',
        'id, assigned_to_user_id, completion_notes',
        'status, priority, actual_cost', // Common in dashboard queries
      ];

      for (const pattern of safePatterns) {
        const result = await validateAgainstKnownIssues('appointment_occurrences', pattern);
        expect(result.isValid).toBe(true);
        expect(result.invalidColumns).toEqual([]);
      }
    });

    it('should detect all known problematic patterns', async () => {
      const problematicPatterns = [
        { table: 'appointment_series', pattern: 'id, notes, title', expectedInvalid: ['notes'] },
        { table: 'appointment_series', pattern: 'estimated_cost, title', expectedInvalid: ['estimated_cost'] },
        { table: 'appointment_series', pattern: 'notes, estimated_cost', expectedInvalid: ['notes', 'estimated_cost'] },
        { table: 'appointment_occurrences', pattern: 'id, override_estimated_cost', expectedInvalid: ['override_estimated_cost'] },
      ];

      for (const { table, pattern, expectedInvalid } of problematicPatterns) {
        const result = await validateAgainstKnownIssues(table, pattern);
        expect(result.isValid).toBe(false);
        for (const invalidCol of expectedInvalid) {
          expect(result.invalidColumns).toContain(invalidCol);
        }
      }
    });
  });

  describe('Complex Select String Parsing', () => {
    it('should handle nested joins correctly', async () => {
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
      
      // Should find the appointment_series table
      const appointmentSeriesSelect = parsedSelects.find(s => s.table === 'appointment_series');
      expect(appointmentSeriesSelect).toBeDefined();
      
      if (appointmentSeriesSelect) {
        expect(appointmentSeriesSelect.columns).toContain('title');
        expect(appointmentSeriesSelect.columns).toContain('description');
        
        // Validate it doesn't contain removed columns
        const result = await validateAgainstKnownIssues(
          'appointment_series',
          appointmentSeriesSelect.columns.join(', ')
        );
        expect(result.isValid).toBe(true);
      }
    });

    it('should handle multiple joins in one query', async () => {
      const multiJoinSelect = `
        id,
        status,
        appointment_series!inner(title, description),
        customer!inner(name, email)
      `;

      const parsedSelects = SchemaValidator.parseSelectString(multiJoinSelect);
      
      // Should find main table columns
      const mainSelect = parsedSelects.find(s => s.table === 'main');
      expect(mainSelect).toBeDefined();
      expect(mainSelect?.columns).toContain('id');
      expect(mainSelect?.columns).toContain('status');
      
      // Should find appointment_series join
      const appointmentSeriesSelect = parsedSelects.find(s => s.table === 'appointment_series');
      expect(appointmentSeriesSelect).toBeDefined();
      expect(appointmentSeriesSelect?.columns).toContain('title');
      expect(appointmentSeriesSelect?.columns).toContain('description');
      
      // Should find customer join
      const customerSelect = parsedSelects.find(s => s.table === 'customer');
      expect(customerSelect).toBeDefined();
      expect(customerSelect?.columns).toContain('name');
      expect(customerSelect?.columns).toContain('email');
    });
  });

  describe('Migration Impact Scenarios', () => {
    it('should identify all queries that would be affected by schema changes', async () => {
      const testQueries = [
        { table: 'appointment_series', select: 'id, title, notes', shouldFail: true },
        { table: 'appointment_series', select: 'id, title, description', shouldFail: false },
        { table: 'appointment_series', select: 'estimated_cost, title', shouldFail: true },
        { table: 'appointment_occurrences', select: 'id, override_estimated_cost', shouldFail: true },
        { table: 'appointment_occurrences', select: 'id, actual_cost', shouldFail: false },
      ];

      for (const query of testQueries) {
        const result = await validateAgainstKnownIssues(query.table, query.select);
        
        if (query.shouldFail) {
          expect(result.isValid).toBe(false);
          expect(result.invalidColumns.length).toBeGreaterThan(0);
        } else {
          expect(result.isValid).toBe(true);
          expect(result.invalidColumns).toEqual([]);
        }
      }
    });

    it('should provide comprehensive migration impact analysis', async () => {
      // Test all known removed columns
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

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty select strings gracefully', async () => {
      const result = await validateAgainstKnownIssues('appointment_series', '');
      expect(result.isValid).toBe(true);
      expect(result.invalidColumns).toEqual([]);
    });

    it('should handle whitespace-only select strings', async () => {
      const result = await validateAgainstKnownIssues('appointment_series', '   ');
      expect(result.isValid).toBe(true);
      expect(result.invalidColumns).toEqual([]);
    });

    it('should handle malformed select strings', async () => {
      const malformedSelects = [
        'id,, title', // Double comma
        'id, , title', // Empty column
        'id,title,', // Trailing comma
      ];

      for (const select of malformedSelects) {
        const result = await validateAgainstKnownIssues('appointment_series', select);
        // Should not throw errors, even with malformed input
        expect(result).toBeDefined();
        expect(result.tableName).toBe('appointment_series');
      }
    });
  });
});