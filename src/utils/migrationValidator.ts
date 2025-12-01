import { SchemaValidator, validateAgainstKnownIssues, KNOWN_REMOVED_COLUMNS } from './schemaValidator';
import fs from 'fs';
import path from 'path';

export interface MigrationValidationReport {
  success: boolean;
  totalQueries: number;
  validQueries: number;
  invalidQueries: number;
  issues: Array<{
    file: string;
    line: number;
    table: string;
    select: string;
    invalidColumns: string[];
    severity: 'error' | 'warning';
  }>;
  recommendations: string[];
  summary: string;
}

/**
 * Migration validator utility for CI/CD pipelines
 */
export class MigrationValidator {
  private static extractQueries(content: string): Array<{ table: string; select: string; line: number }> {
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

  private static scanDirectory(dir: string, extensions = ['.ts', '.tsx', '.js', '.jsx']): string[] {
    const files: string[] = [];
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          files.push(...this.scanDirectory(fullPath, extensions));
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Could not scan directory ${dir}:`, error);
    }
    
    return files;
  }

  /**
   * Validate all database queries in the codebase
   */
  static async validateCodebase(srcDir: string = 'src'): Promise<MigrationValidationReport> {
    const report: MigrationValidationReport = {
      success: true,
      totalQueries: 0,
      validQueries: 0,
      invalidQueries: 0,
      issues: [],
      recommendations: [],
      summary: '',
    };

    try {
      // Scan for all TypeScript/JavaScript files
      const files = this.scanDirectory(path.resolve(srcDir));
      
      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const queries = this.extractQueries(content);
          
          for (const query of queries) {
            report.totalQueries++;
            
            // Validate against known removed columns
            const result = await validateAgainstKnownIssues(query.table, query.select);
            
            if (result.isValid) {
              report.validQueries++;
            } else {
              report.invalidQueries++;
              report.success = false;
              
              report.issues.push({
                file: path.relative(process.cwd(), file),
                line: query.line,
                table: query.table,
                select: query.select,
                invalidColumns: result.invalidColumns,
                severity: 'error',
              });
            }
          }
        } catch (error) {
          console.warn(`Could not process file ${file}:`, error);
        }
      }

      // Generate recommendations
      if (report.invalidQueries > 0) {
        report.recommendations.push(
          'Update queries to remove references to non-existent columns',
          'Consider using explicit column selection instead of wildcards for better schema change resilience',
          'Add schema validation tests to catch these issues earlier'
        );
      }

      // Generate summary
      report.summary = `Validated ${report.totalQueries} database queries. ` +
        `${report.validQueries} valid, ${report.invalidQueries} invalid.`;

      if (report.invalidQueries > 0) {
        report.summary += ` ${report.invalidQueries} queries need to be fixed before deployment.`;
      }

    } catch (error) {
      report.success = false;
      report.summary = `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return report;
  }

  /**
   * Validate queries against a specific migration
   */
  static async validateMigration(
    tableName: string,
    removedColumns: string[],
    addedColumns: string[] = [],
    srcDir: string = 'src'
  ): Promise<MigrationValidationReport> {
    const report = await this.validateCodebase(srcDir);
    
    // Add migration-specific analysis
    const migrationImpact = await SchemaValidator.analyzeMigrationImpact(
      tableName,
      removedColumns,
      addedColumns
    );

    report.recommendations.push(...migrationImpact.recommendations);

    // Filter issues to only those related to this migration
    report.issues = report.issues.filter(issue => 
      issue.table === tableName && 
      issue.invalidColumns.some(col => removedColumns.includes(col))
    );

    report.invalidQueries = report.issues.length;
    report.validQueries = report.totalQueries - report.invalidQueries;
    report.success = report.invalidQueries === 0;

    report.summary = `Migration validation for ${tableName}: ` +
      `${report.invalidQueries} queries affected by removal of columns [${removedColumns.join(', ')}].`;

    return report;
  }

  /**
   * Generate a detailed report for CI/CD
   */
  static formatReport(report: MigrationValidationReport): string {
    let output = `\n=== Database Query Migration Validation Report ===\n\n`;
    
    output += `Status: ${report.success ? '✅ PASS' : '❌ FAIL'}\n`;
    output += `Summary: ${report.summary}\n\n`;

    if (report.issues.length > 0) {
      output += `Issues Found (${report.issues.length}):\n`;
      for (const issue of report.issues) {
        output += `  ❌ ${issue.file}:${issue.line}\n`;
        output += `     Table: ${issue.table}\n`;
        output += `     Invalid columns: ${issue.invalidColumns.join(', ')}\n`;
        output += `     Query: ${issue.select.substring(0, 100)}${issue.select.length > 100 ? '...' : ''}\n\n`;
      }
    }

    if (report.recommendations.length > 0) {
      output += `Recommendations:\n`;
      for (const rec of report.recommendations) {
        output += `  💡 ${rec}\n`;
      }
      output += '\n';
    }

    output += `Statistics:\n`;
    output += `  Total queries: ${report.totalQueries}\n`;
    output += `  Valid queries: ${report.validQueries}\n`;
    output += `  Invalid queries: ${report.invalidQueries}\n`;

    return output;
  }

  /**
   * CLI entry point for migration validation
   */
  static async runCLI(): Promise<void> {
    const args = process.argv.slice(2);
    const srcDir = args[0] || 'src';

    console.log('🔍 Running database query migration validation...\n');

    try {
      const report = await this.validateCodebase(srcDir);
      const formattedReport = this.formatReport(report);
      
      console.log(formattedReport);

      // Exit with error code if validation failed
      if (!report.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  }
}

// CLI support
if (require.main === module) {
  MigrationValidator.runCLI();
}