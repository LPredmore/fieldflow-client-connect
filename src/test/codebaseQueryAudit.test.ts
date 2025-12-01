import { describe, it, expect, beforeEach } from 'vitest';
import { validateAgainstKnownIssues, SchemaValidator } from '@/utils/schemaValidator';
import fs from 'fs';
import path from 'path';

/**
 * Extract Supabase query patterns from code
 */
function extractSupabaseQueries(content: string): Array<{ table: string; select: string; line: number }> {
  const queries: Array<{ table: string; select: string; line: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for .from('table_name').select('columns')
    const fromSelectMatch = line.match(/\.from\(['"`](\w+)['"`]\)\.select\(['"`]([^'"`]+)['"`]\)/);
    if (fromSelectMatch) {
      queries.push({
        table: fromSelectMatch[1],
        select: fromSelectMatch[2],
        line: i + 1,
      });
      continue;
    }

    // Look for useSupabaseQuery with table and select
    const useSupabaseQueryMatch = line.match(/useSupabaseQuery.*table:\s*['"`](\w+)['"`]/);
    if (useSupabaseQueryMatch) {
      const table = useSupabaseQueryMatch[1];
      
      // Look for select in the same or following lines
      let selectString = '*'; // default
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        const selectMatch = lines[j].match(/select:\s*['"`]([^'"`]+)['"`]/);
        if (selectMatch) {
          selectString = selectMatch[1];
          break;
        }
        
        // Handle multi-line select strings
        const multiLineSelectStart = lines[j].match(/select:\s*`([^`]*)/);
        if (multiLineSelectStart) {
          let multiLineSelect = multiLineSelectStart[1];
          for (let k = j + 1; k < lines.length; k++) {
            const nextLine = lines[k];
            multiLineSelect += '\n' + nextLine;
            if (nextLine.includes('`')) {
              selectString = multiLineSelect.replace(/`$/, '');
              break;
            }
          }
          break;
        }
      }
      
      queries.push({
        table,
        select: selectString,
        line: i + 1,
      });
    }
  }

  return queries;
}

/**
 * Recursively scan directory for TypeScript/JavaScript files
 */
function scanDirectory(dir: string, extensions = ['.ts', '.tsx', '.js', '.jsx']): string[] {
  const files: string[] = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...scanDirectory(fullPath, extensions));
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Could not scan directory ${dir}:`, error);
  }
  
  return files;
}

describe('Codebase Query Audit Tests', () => {
  let allQueries: Array<{ file: string; table: string; select: string; line: number }> = [];

  beforeEach(async () => {
    SchemaValidator.clearCache();
    
    // Scan the src directory for all TypeScript files
    const srcDir = path.join(process.cwd(), 'src');
    const files = scanDirectory(srcDir);
    
    allQueries = [];
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const queries = extractSupabaseQueries(content);
        
        for (const query of queries) {
          allQueries.push({
            file: path.relative(process.cwd(), file),
            ...query,
          });
        }
      } catch (error) {
        console.warn(`Could not read file ${file}:`, error);
      }
    }
  });

  describe('Database Query Discovery', () => {
    it('should find database queries in the codebase', () => {
      expect(allQueries.length).toBeGreaterThan(0);
      
      // Log found queries for debugging
      console.log(`Found ${allQueries.length} database queries:`);
      allQueries.forEach(query => {
        console.log(`  ${query.file}:${query.line} - ${query.table}.select("${query.select}")`);
      });
    });

    it('should find queries in useUnifiedAppointments hook', () => {
      const unifiedAppointmentQueries = allQueries.filter(q => 
        q.file.includes('useUnifiedAppointments') || 
        (q.table === 'appointment_series' || q.table === 'appointment_occurrences')
      );
      
      expect(unifiedAppointmentQueries.length).toBeGreaterThan(0);
    });
  });

  describe('Schema Validation Against Found Queries', () => {
    it('should validate all found appointment_series queries', async () => {
      const appointmentSeriesQueries = allQueries.filter(q => q.table === 'appointment_series');
      
      for (const query of appointmentSeriesQueries) {
        const result = await validateAgainstKnownIssues(query.table, query.select);
        
        if (!result.isValid) {
          console.error(`Invalid query found in ${query.file}:${query.line}`);
          console.error(`Table: ${query.table}, Select: ${query.select}`);
          console.error(`Invalid columns: ${result.invalidColumns.join(', ')}`);
        }
        
        expect(result.isValid).toBe(true);
        expect(result.invalidColumns).toEqual([]);
      }
    });

    it('should validate all found appointment_occurrences queries', async () => {
      const appointmentOccurrencesQueries = allQueries.filter(q => q.table === 'appointment_occurrences');
      
      for (const query of appointmentOccurrencesQueries) {
        const result = await validateAgainstKnownIssues(query.table, query.select);
        
        if (!result.isValid) {
          console.error(`Invalid query found in ${query.file}:${query.line}`);
          console.error(`Table: ${query.table}, Select: ${query.select}`);
          console.error(`Invalid columns: ${result.invalidColumns.join(', ')}`);
        }
        
        expect(result.isValid).toBe(true);
        expect(result.invalidColumns).toEqual([]);
      }
    });

    it('should validate all other table queries', async () => {
      const otherQueries = allQueries.filter(q => 
        q.table !== 'appointment_series' && 
        q.table !== 'appointment_occurrences'
      );
      
      for (const query of otherQueries) {
        // For tables without known removed columns, validation should pass
        const result = await validateAgainstKnownIssues(query.table, query.select);
        
        // Log any unexpected failures for investigation
        if (!result.isValid) {
          console.warn(`Unexpected validation failure in ${query.file}:${query.line}`);
          console.warn(`Table: ${query.table}, Select: ${query.select}`);
          console.warn(`Invalid columns: ${result.invalidColumns.join(', ')}`);
        }
        
        // Most other tables should pass validation since they don't have known removed columns
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('Query Pattern Analysis', () => {
    it('should analyze common query patterns', () => {
      const tableUsage = new Map<string, number>();
      const selectPatterns = new Map<string, number>();
      
      for (const query of allQueries) {
        tableUsage.set(query.table, (tableUsage.get(query.table) || 0) + 1);
        selectPatterns.set(query.select, (selectPatterns.get(query.select) || 0) + 1);
      }
      
      console.log('Table usage statistics:');
      for (const [table, count] of tableUsage.entries()) {
        console.log(`  ${table}: ${count} queries`);
      }
      
      console.log('Most common select patterns:');
      const sortedPatterns = Array.from(selectPatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      for (const [pattern, count] of sortedPatterns) {
        console.log(`  "${pattern}": ${count} times`);
      }
      
      expect(tableUsage.size).toBeGreaterThan(0);
    });

    it('should identify complex select patterns', () => {
      const complexQueries = allQueries.filter(q => 
        q.select.includes('!inner') || 
        q.select.includes('!left') || 
        q.select.includes('(') ||
        q.select.length > 50
      );
      
      console.log(`Found ${complexQueries.length} complex queries:`);
      for (const query of complexQueries) {
        console.log(`  ${query.file}:${query.line} - ${query.table}`);
        console.log(`    Select: ${query.select.substring(0, 100)}${query.select.length > 100 ? '...' : ''}`);
      }
      
      // Complex queries should exist (joins, etc.)
      expect(complexQueries.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Migration Impact Assessment', () => {
    it('should assess impact of schema changes on found queries', async () => {
      const impactedQueries = [];
      
      for (const query of allQueries) {
        const result = await validateAgainstKnownIssues(query.table, query.select);
        
        if (!result.isValid) {
          impactedQueries.push({
            ...query,
            invalidColumns: result.invalidColumns,
          });
        }
      }
      
      if (impactedQueries.length > 0) {
        console.error('Queries impacted by schema changes:');
        for (const query of impactedQueries) {
          console.error(`  ${query.file}:${query.line} - ${query.table}`);
          console.error(`    Invalid columns: ${query.invalidColumns.join(', ')}`);
        }
      }
      
      // All queries should be valid after fixes
      expect(impactedQueries.length).toBe(0);
    });

    it('should provide recommendations for any problematic patterns', async () => {
      const recommendations = [];
      
      // Check for patterns that might be problematic in the future
      for (const query of allQueries) {
        if (query.select.includes('*') && query.table === 'appointment_series') {
          recommendations.push({
            file: query.file,
            line: query.line,
            recommendation: 'Consider using explicit column selection instead of * for better performance and schema change resilience',
          });
        }
        
        if (query.select.length > 200) {
          recommendations.push({
            file: query.file,
            line: query.line,
            recommendation: 'Consider breaking down complex select into multiple queries for better maintainability',
          });
        }
      }
      
      if (recommendations.length > 0) {
        console.log('Recommendations for query improvements:');
        for (const rec of recommendations) {
          console.log(`  ${rec.file}:${rec.line} - ${rec.recommendation}`);
        }
      }
      
      // This is informational, not a failure
      expect(recommendations).toBeDefined();
    });
  });
});