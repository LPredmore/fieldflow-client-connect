#!/usr/bin/env node

/**
 * Database Policy Analysis Script
 * 
 * This script analyzes RLS policies in the Supabase database to identify:
 * 1. All existing RLS policies on tables that interact with clinicians
 * 2. Circular references between policies
 * 3. Problematic patterns that could cause infinite recursion
 * 
 * Requirements: 2.1, 2.2
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PolicyAnalyzer {
  constructor() {
    this.policies = new Map();
    this.tableDependencies = new Map();
    this.circularReferences = [];
    this.migrationFiles = [];
  }

  /**
   * Load all migration files and extract policy information
   */
  loadMigrationFiles() {
    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.error('Migrations directory not found:', migrationsDir);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      this.migrationFiles.push({ file, content });
    }
  }

  /**
   * Extract all CREATE POLICY statements from migration files
   */
  extractPolicies() {
    const policyRegex = /CREATE POLICY\s+"([^"]+)"\s+ON\s+(\w+\.)?(\w+)\s+(FOR\s+\w+)?\s*(TO\s+\w+)?\s*(USING\s*\(([^;]+)\))?\s*(WITH\s+CHECK\s*\(([^;]+)\))?/gis;
    
    for (const { file, content } of this.migrationFiles) {
      let match;
      while ((match = policyRegex.exec(content)) !== null) {
        const [, policyName, schema, tableName, forClause, toClause, , usingClause, , withCheckClause] = match;
        
        const policy = {
          name: policyName,
          table: tableName,
          schema: schema || 'public',
          forClause: forClause || '',
          toClause: toClause || '',
          usingClause: usingClause || '',
          withCheckClause: withCheckClause || '',
          file: file
        };

        if (!this.policies.has(tableName)) {
          this.policies.set(tableName, []);
        }
        this.policies.get(tableName).push(policy);
      }
    }

    console.log(`Extracted ${Array.from(this.policies.values()).flat().length} policies from ${this.policies.size} tables`);
  }

  /**
   * Analyze policy dependencies to find circular references
   */
  analyzeDependencies() {
    for (const [tableName, policies] of this.policies) {
      const dependencies = new Set();
      
      for (const policy of policies) {
        const allClauses = `${policy.usingClause} ${policy.withCheckClause}`;
        
        // Find table references in policy clauses
        const tableReferences = this.extractTableReferences(allClauses);
        
        for (const ref of tableReferences) {
          if (ref !== tableName) {
            dependencies.add(ref);
          }
        }
      }
      
      this.tableDependencies.set(tableName, Array.from(dependencies));
    }
  }

  /**
   * Extract table references from SQL clauses
   */
  extractTableReferences(clause) {
    const references = new Set();
    
    // Common patterns for table references in RLS policies
    const patterns = [
      /FROM\s+(?:public\.)?(\w+)/gi,
      /JOIN\s+(?:public\.)?(\w+)/gi,
      /EXISTS\s*\(\s*SELECT[^)]*FROM\s+(?:public\.)?(\w+)/gi,
      /IN\s*\(\s*SELECT[^)]*FROM\s+(?:public\.)?(\w+)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(clause)) !== null) {
        references.add(match[1]);
      }
    }

    return Array.from(references);
  }

  /**
   * Find circular dependencies using depth-first search
   */
  findCircularReferences() {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (table, path = []) => {
      if (recursionStack.has(table)) {
        // Found a cycle
        const cycleStart = path.indexOf(table);
        const cycle = path.slice(cycleStart).concat([table]);
        cycles.push(cycle);
        return;
      }

      if (visited.has(table)) {
        return;
      }

      visited.add(table);
      recursionStack.add(table);
      path.push(table);

      const dependencies = this.tableDependencies.get(table) || [];
      for (const dep of dependencies) {
        dfs(dep, [...path]);
      }

      recursionStack.delete(table);
    };

    for (const table of this.tableDependencies.keys()) {
      if (!visited.has(table)) {
        dfs(table);
      }
    }

    this.circularReferences = cycles;
  }

  /**
   * Generate comprehensive analysis report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTables: this.policies.size,
        totalPolicies: Array.from(this.policies.values()).flat().length,
        tablesWithDependencies: Array.from(this.tableDependencies.values()).filter(deps => deps.length > 0).length,
        circularReferences: this.circularReferences.length
      },
      tableAnalysis: {},
      circularReferences: this.circularReferences,
      cliniciansTableAnalysis: this.analyzeCliniciansPolicies(),
      recommendations: this.generateRecommendations()
    };

    // Detailed table analysis
    for (const [tableName, policies] of this.policies) {
      const dependencies = this.tableDependencies.get(tableName) || [];
      
      report.tableAnalysis[tableName] = {
        policyCount: policies.length,
        dependencies: dependencies,
        policies: policies.map(p => ({
          name: p.name,
          forClause: p.forClause,
          hasComplexLogic: this.hasComplexLogic(p),
          referencesAuth: this.referencesAuth(p),
          file: p.file
        }))
      };
    }

    return report;
  }

  /**
   * Analyze clinicians table policies specifically
   */
  analyzeCliniciansPolicies() {
    const cliniciansPolicies = this.policies.get('clinicians') || [];
    const analysis = {
      totalPolicies: cliniciansPolicies.length,
      policies: [],
      potentialIssues: []
    };

    for (const policy of cliniciansPolicies) {
      const policyAnalysis = {
        name: policy.name,
        type: this.getPolicyType(policy),
        complexity: this.getPolicyComplexity(policy),
        dependencies: this.extractTableReferences(`${policy.usingClause} ${policy.withCheckClause}`),
        usesDirectAuth: this.referencesAuth(policy),
        file: policy.file
      };

      analysis.policies.push(policyAnalysis);

      // Check for potential issues
      if (policyAnalysis.dependencies.includes('profiles') && policyAnalysis.complexity === 'high') {
        analysis.potentialIssues.push({
          policy: policy.name,
          issue: 'Complex policy with profiles dependency - potential circular reference',
          severity: 'high'
        });
      }

      if (!policyAnalysis.usesDirectAuth && policyAnalysis.dependencies.length > 0) {
        analysis.potentialIssues.push({
          policy: policy.name,
          issue: 'Policy does not use direct auth.uid() and has table dependencies',
          severity: 'medium'
        });
      }
    }

    return analysis;
  }

  /**
   * Check if policy has complex logic
   */
  hasComplexLogic(policy) {
    const allClauses = `${policy.usingClause} ${policy.withCheckClause}`;
    const complexPatterns = [
      /EXISTS\s*\(/i,
      /IN\s*\(\s*SELECT/i,
      /JOIN/i,
      /CASE\s+WHEN/i
    ];

    return complexPatterns.some(pattern => pattern.test(allClauses));
  }

  /**
   * Check if policy references auth.uid()
   */
  referencesAuth(policy) {
    const allClauses = `${policy.usingClause} ${policy.withCheckClause}`;
    return /auth\.uid\(\)/i.test(allClauses);
  }

  /**
   * Get policy type (SELECT, INSERT, UPDATE, DELETE, ALL)
   */
  getPolicyType(policy) {
    const forClause = policy.forClause.toUpperCase();
    if (forClause.includes('SELECT')) return 'SELECT';
    if (forClause.includes('INSERT')) return 'INSERT';
    if (forClause.includes('UPDATE')) return 'UPDATE';
    if (forClause.includes('DELETE')) return 'DELETE';
    if (forClause.includes('ALL')) return 'ALL';
    return 'UNKNOWN';
  }

  /**
   * Get policy complexity level
   */
  getPolicyComplexity(policy) {
    const allClauses = `${policy.usingClause} ${policy.withCheckClause}`;
    const dependencies = this.extractTableReferences(allClauses);
    
    if (dependencies.length === 0 && /auth\.uid\(\)/i.test(allClauses)) {
      return 'low';
    } else if (dependencies.length <= 1) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.circularReferences.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'circular_references',
        title: 'Fix Circular Policy References',
        description: `Found ${this.circularReferences.length} circular reference(s) that could cause infinite recursion`,
        action: 'Restructure policies to eliminate circular dependencies'
      });
    }

    const cliniciansAnalysis = this.analyzeCliniciansPolicies();
    const highRiskPolicies = cliniciansAnalysis.potentialIssues.filter(issue => issue.severity === 'high');
    
    if (highRiskPolicies.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'clinicians_policies',
        title: 'Simplify Clinicians Table Policies',
        description: `Found ${highRiskPolicies.length} high-risk policy/policies on clinicians table`,
        action: 'Replace complex policies with direct auth.uid() comparisons'
      });
    }

    // Check for policies that don't use direct auth
    let nonDirectAuthCount = 0;
    for (const [tableName, policies] of this.policies) {
      for (const policy of policies) {
        if (!this.referencesAuth(policy) && this.extractTableReferences(`${policy.usingClause} ${policy.withCheckClause}`).length > 0) {
          nonDirectAuthCount++;
        }
      }
    }

    if (nonDirectAuthCount > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'authentication',
        title: 'Optimize Authentication Patterns',
        description: `Found ${nonDirectAuthCount} policies that could benefit from direct auth.uid() usage`,
        action: 'Consider simplifying policies to use direct authentication where appropriate'
      });
    }

    return recommendations;
  }

  /**
   * Run the complete analysis
   */
  async run() {
    console.log('🔍 Starting Database Policy Analysis...\n');
    
    this.loadMigrationFiles();
    this.extractPolicies();
    this.analyzeDependencies();
    this.findCircularReferences();
    
    const report = this.generateReport();
    
    // Save report to file
    const reportPath = path.join(__dirname, '..', 'policy-analysis-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('📊 Analysis Complete!\n');
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tables: ${report.summary.totalTables}`);
    console.log(`Total Policies: ${report.summary.totalPolicies}`);
    console.log(`Tables with Dependencies: ${report.summary.tablesWithDependencies}`);
    console.log(`Circular References: ${report.summary.circularReferences}`);
    
    if (report.circularReferences.length > 0) {
      console.log('\n🚨 CIRCULAR REFERENCES DETECTED:');
      for (const cycle of report.circularReferences) {
        console.log(`   ${cycle.join(' → ')}`);
      }
    }
    
    console.log('\n📋 CLINICIANS TABLE ANALYSIS:');
    console.log(`   Policies: ${report.cliniciansTableAnalysis.totalPolicies}`);
    console.log(`   Issues: ${report.cliniciansTableAnalysis.potentialIssues.length}`);
    
    if (report.cliniciansTableAnalysis.potentialIssues.length > 0) {
      console.log('\n⚠️  CLINICIANS TABLE ISSUES:');
      for (const issue of report.cliniciansTableAnalysis.potentialIssues) {
        console.log(`   [${issue.severity.toUpperCase()}] ${issue.policy}: ${issue.issue}`);
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    for (const rec of report.recommendations) {
      console.log(`   [${rec.priority.toUpperCase()}] ${rec.title}`);
      console.log(`      ${rec.description}`);
      console.log(`      Action: ${rec.action}\n`);
    }
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
    
    return report;
  }
}

// Run the analysis if this script is executed directly
const analyzer = new PolicyAnalyzer();
analyzer.run().catch(console.error);

export default PolicyAnalyzer;