#!/usr/bin/env node

/**
 * Combined Migration Deployment Script
 * 
 * This script combines the migration executor and deployment validator
 * to provide a complete deployment workflow with rollback capability.
 * 
 * Usage:
 *   node scripts/deploy-migration.js [migration-file] [--validate-only] [--skip-validation]
 * 
 * Requirements: 1.1, 2.1, 2.2, 4.1
 */

import MigrationExecutor from './migration-executor.js';
import DeploymentValidator from './deployment-validator.js';

class MigrationDeployer {
  constructor() {
    this.executor = new MigrationExecutor();
    this.validator = new DeploymentValidator();
    this.options = {
      validateOnly: false,
      skipValidation: false,
      migrationFile: '20251007_fix_clinicians_infinite_recursion.sql'
    };
  }

  /**
   * Parse command line arguments
   */
  parseArguments() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--validate-only') {
        this.options.validateOnly = true;
      } else if (arg === '--skip-validation') {
        this.options.skipValidation = true;
      } else if (arg === '--help' || arg === '-h') {
        this.showHelp();
        process.exit(0);
      } else if (!arg.startsWith('--')) {
        // Assume it's a migration file
        this.options.migrationFile = arg;
      }
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
Migration Deployment Script

Usage: node scripts/deploy-migration.js [migration-file] [options]

Arguments:
  migration-file    SQL migration file to execute (default: 20251007_fix_clinicians_infinite_recursion.sql)

Options:
  --validate-only   Only run validation tests, skip migration execution
  --skip-validation Skip post-migration validation (not recommended)
  --help, -h        Show this help message

Examples:
  node scripts/deploy-migration.js
  node scripts/deploy-migration.js my-migration.sql
  node scripts/deploy-migration.js --validate-only
  node scripts/deploy-migration.js my-migration.sql --skip-validation

This script will:
1. Run pre-migration validation
2. Execute the migration with rollback capability
3. Run post-migration validation
4. Generate comprehensive reports
`);
  }

  /**
   * Main deployment workflow
   */
  async deploy() {
    console.log('🚀 Starting Migration Deployment Workflow');
    console.log('='.repeat(70));
    console.log(`Migration File: ${this.options.migrationFile}`);
    console.log(`Validate Only: ${this.options.validateOnly}`);
    console.log(`Skip Validation: ${this.options.skipValidation}`);
    console.log('='.repeat(70));

    const results = {
      migration: null,
      validation: null,
      success: false,
      error: null
    };

    try {
      if (this.options.validateOnly) {
        // Only run validation
        console.log('\n📋 Running validation only...');
        results.validation = await this.validator.validate();
        results.success = results.validation.summary.overallStatus === 'PASSED';
      } else {
        // Run full deployment workflow
        console.log('\n🔧 Executing migration...');
        results.migration = await this.executor.execute(this.options.migrationFile);
        
        if (!this.options.skipValidation) {
          console.log('\n📋 Running post-migration validation...');
          results.validation = await this.validator.validate();
          results.success = results.migration.summary.success && 
                           results.validation.summary.overallStatus === 'PASSED';
        } else {
          results.success = results.migration.summary.success;
        }
      }

      // Final summary
      console.log('\n' + '='.repeat(70));
      console.log('DEPLOYMENT WORKFLOW COMPLETE');
      console.log('='.repeat(70));
      
      if (results.migration) {
        console.log(`Migration Status: ${results.migration.summary.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      if (results.validation) {
        console.log(`Validation Status: ${results.validation.summary.overallStatus}`);
        console.log(`Validation Success Rate: ${results.validation.summary.successRate}%`);
      }
      
      console.log(`Overall Success: ${results.success ? 'YES' : 'NO'}`);

      if (results.success) {
        console.log('\n✅ Deployment completed successfully!');
        console.log('   The clinicians infinite recursion fix has been deployed and validated.');
        
        if (results.validation?.summary.warnings > 0) {
          console.log(`   Note: ${results.validation.summary.warnings} warning(s) were found - review the validation report.`);
        }
      } else {
        console.log('\n❌ Deployment failed or has issues.');
        console.log('   Please review the reports and address any problems.');
        
        if (results.migration && !results.migration.summary.success) {
          console.log('   Migration failed - check migration report for details.');
        }
        
        if (results.validation && results.validation.summary.failed > 0) {
          console.log('   Validation failed - check validation report for details.');
        }
      }

      return results;

    } catch (error) {
      console.log(`\n❌ Deployment workflow error: ${error.message}`);
      results.error = error.message;
      results.success = false;
      
      throw error;
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const deployer = new MigrationDeployer();
  deployer.parseArguments();
  
  deployer.deploy()
    .then((results) => {
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Deployment failed:', error.message);
      process.exit(1);
    });
}

export default MigrationDeployer;