/**
 * Performance Validation System
 * 
 * Validates performance improvements against target metrics and provides
 * comprehensive reporting on optimization effectiveness.
 */

import { successMetricsTracker, SuccessMetricsReport, ValidationResult } from './successMetricsTracker';
import { performanceAlertingSystem } from './performanceAlertingSystem';
import { getPerformanceFeatureFlags } from './performanceFeatureFlags';
import { queryPerformanceMonitor } from './queryPerformanceMonitor';

export interface PerformanceValidationConfig {
  /** Minimum success score required for validation to pass */
  minimumSuccessScore: number;
  /** Minimum percentage of targets that must be achieved */
  minimumTargetAchievementRate: number;
  /** Minimum confidence level required for metrics */
  minimumConfidenceLevel: number;
  /** Time window for validation measurements (ms) */
  validationTimeWindow: number;
  /** Whether to include user impact analysis */
  includeUserImpactAnalysis: boolean;
  /** Whether to generate detailed reports */
  generateDetailedReports: boolean;
}

export interface ValidationReport {
  /** Overall validation result */
  overallResult: 'PASSED' | 'FAILED' | 'PARTIAL';
  /** Validation score (0-100) */
  validationScore: number;
  /** Timestamp of validation */
  validatedAt: number;
  /** Configuration used for validation */
  config: PerformanceValidationConfig;
  /** Success metrics report */
  successMetrics: SuccessMetricsReport;
  /** Target validation results */
  targetValidation: ValidationResult[];
}