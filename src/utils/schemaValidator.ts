import { supabase } from '@/integrations/supabase/client';

export interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export interface QueryValidationResult {
  isValid: boolean;
  invalidColumns: string[];
  validColumns: string[];
  tableName: string;
  error?: string;
}

export interface MigrationImpactResult {
  affectedQueries: string[];
  potentialIssues: string[];
  recommendations: string[];
}

/**
 * Schema validator utility for validating database queries against current schema
 */
export class SchemaValidator {
  private static schemaCache = new Map<string, TableColumn[]>();
  private static cacheTimestamp = new Map<string, number>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get current schema for a table from the database
   */
  static async getTableSchema(tableName: string): Promise<TableColumn[]> {
    const now = Date.now();
    const cached = this.schemaCache.get(tableName);
    const cacheTime = this.cacheTimestamp.get(tableName) || 0;

    // Return cached schema if still valid
    if (cached && (now - cacheTime) < this.CACHE_TTL) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', tableName)
        .eq('table_schema', 'public')
        .order('ordinal_position');

      if (error) {
        throw new Error(`Failed to fetch schema for table ${tableName}: ${error.message}`);
      }

      const schema = data as TableColumn[];
      this.schemaCache.set(tableName, schema);
      this.cacheTimestamp.set(tableName, now);
      
      return schema;
    } catch (error) {
      console.error(`Error fetching schema for table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get all valid column names for a table
   */
  static async getValidColumns(tableName: string): Promise<string[]> {
    const schema = await this.getTableSchema(tableName);
    return schema.map(col => col.column_name);
  }

  /**
   * Validate that specified columns exist in the table
   */
  static async validateColumns(tableName: string, columns: string[]): Promise<QueryValidationResult> {
    try {
      const validColumns = await this.getValidColumns(tableName);
      const invalidColumns = columns.filter(col => !validColumns.includes(col));

      return {
        isValid: invalidColumns.length === 0,
        invalidColumns,
        validColumns: columns.filter(col => validColumns.includes(col)),
        tableName,
      };
    } catch (error) {
      return {
        isValid: false,
        invalidColumns: columns,
        validColumns: [],
        tableName,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse a Supabase select string and extract column references
   */
  static parseSelectString(selectString: string): { table: string; columns: string[] }[] {
    const results: { table: string; columns: string[] }[] = [];
    
    // Clean up the select string
    const cleanSelect = selectString.replace(/\s+/g, ' ').trim();
    
    // Handle simple column lists (e.g., "id, name, email")
    if (!cleanSelect.includes('(')) {
      return [{ table: 'main', columns: cleanSelect.split(',').map(col => col.trim()) }];
    }

    // Handle complex selects with joins
    const mainColumns: string[] = [];
    let currentPos = 0;
    
    while (currentPos < cleanSelect.length) {
      // Find the next comma or opening parenthesis
      let nextComma = cleanSelect.indexOf(',', currentPos);
      let nextParen = cleanSelect.indexOf('(', currentPos);
      
      if (nextParen !== -1 && (nextComma === -1 || nextParen < nextComma)) {
        // We found a join/relation before the next comma
        const beforeParen = cleanSelect.substring(currentPos, nextParen).trim();
        
        if (beforeParen && beforeParen !== '*') {
          // This might be a column before the join
          const parts = beforeParen.split(',').map(p => p.trim()).filter(p => p);
          for (const part of parts) {
            if (part !== '*') {
              mainColumns.push(part);
            }
          }
        }
        
        // Find the matching closing parenthesis
        let parenCount = 1;
        let pos = nextParen + 1;
        while (pos < cleanSelect.length && parenCount > 0) {
          if (cleanSelect[pos] === '(') parenCount++;
          if (cleanSelect[pos] === ')') parenCount--;
          pos++;
        }
        
        // Extract the join part
        const joinPart = cleanSelect.substring(currentPos, pos).trim();
        const match = joinPart.match(/(\w+)(?:!\w+)?\s*\(\s*([^)]+)\s*\)/);
        if (match) {
          const [, tableName, columnList] = match;
          const columns = columnList.split(',').map(col => col.trim()).filter(col => col);
          results.push({ table: tableName, columns });
        }
        
        currentPos = pos;
        // Skip the comma if it's right after the closing paren
        if (currentPos < cleanSelect.length && cleanSelect[currentPos] === ',') {
          currentPos++;
        }
      } else if (nextComma !== -1) {
        // Regular column before comma
        const column = cleanSelect.substring(currentPos, nextComma).trim();
        if (column && column !== '*') {
          mainColumns.push(column);
        }
        currentPos = nextComma + 1;
      } else {
        // Last part
        const column = cleanSelect.substring(currentPos).trim();
        if (column && column !== '*') {
          mainColumns.push(column);
        }
        break;
      }
    }

    if (mainColumns.length > 0) {
      results.unshift({ table: 'main', columns: mainColumns });
    }

    return results;
  }

  /**
   * Validate a complete Supabase query structure
   */
  static async validateQuery(
    mainTable: string,
    selectString: string = '*'
  ): Promise<QueryValidationResult[]> {
    const parsedSelects = this.parseSelectString(selectString);
    const results: QueryValidationResult[] = [];

    for (const { table, columns } of parsedSelects) {
      const tableName = table === 'main' ? mainTable : table;
      
      // Skip validation for wildcard selects
      if (columns.includes('*')) {
        results.push({
          isValid: true,
          invalidColumns: [],
          validColumns: ['*'],
          tableName,
        });
        continue;
      }

      const result = await this.validateColumns(tableName, columns);
      results.push(result);
    }

    return results;
  }

  /**
   * Analyze potential migration impact on existing queries
   */
  static async analyzeMigrationImpact(
    tableName: string,
    removedColumns: string[],
    addedColumns: string[] = []
  ): Promise<MigrationImpactResult> {
    const affectedQueries: string[] = [];
    const potentialIssues: string[] = [];
    const recommendations: string[] = [];

    // Check if any removed columns would affect common query patterns
    for (const column of removedColumns) {
      potentialIssues.push(`Column '${column}' removed from table '${tableName}'`);
      affectedQueries.push(`SELECT queries referencing '${tableName}.${column}'`);
      recommendations.push(`Update all queries that reference '${tableName}.${column}' to use alternative columns or remove the reference`);
    }

    // Provide recommendations for added columns
    for (const column of addedColumns) {
      recommendations.push(`Consider updating queries to utilize new column '${tableName}.${column}' if relevant`);
    }

    return {
      affectedQueries,
      potentialIssues,
      recommendations,
    };
  }

  /**
   * Clear the schema cache (useful for testing or after migrations)
   */
  static clearCache(): void {
    this.schemaCache.clear();
    this.cacheTimestamp.clear();
  }

  /**
   * Log detailed query structure for debugging
   */
  static logQueryStructure(tableName: string, selectString: string, filters?: Record<string, any>): void {
    console.group(`🔍 Query Structure Analysis - ${tableName}`);
    console.log('Table:', tableName);
    console.log('Select:', selectString);
    console.log('Filters:', filters);
    
    const parsedSelects = this.parseSelectString(selectString);
    console.log('Parsed Selects:', parsedSelects);
    
    console.groupEnd();
  }
}

/**
 * Known problematic column references that have been removed from the schema
 */
export const KNOWN_REMOVED_COLUMNS = {
  appointment_series: ['notes', 'estimated_cost'],
  appointment_occurrences: ['override_estimated_cost'],
} as const;

/**
 * Validate that a query doesn't reference any known removed columns
 */
export async function validateAgainstKnownIssues(
  tableName: string,
  selectString: string
): Promise<QueryValidationResult> {
  const removedColumns = KNOWN_REMOVED_COLUMNS[tableName as keyof typeof KNOWN_REMOVED_COLUMNS] || [];
  const parsedSelects = SchemaValidator.parseSelectString(selectString);
  
  const referencedColumns = parsedSelects
    .filter(select => select.table === 'main' || select.table === tableName)
    .flatMap(select => select.columns);

  const invalidColumns = referencedColumns.filter(col => 
    (removedColumns as readonly string[]).includes(col)
  );

  return {
    isValid: invalidColumns.length === 0,
    invalidColumns,
    validColumns: referencedColumns.filter(col => !invalidColumns.includes(col)),
    tableName,
  };
}