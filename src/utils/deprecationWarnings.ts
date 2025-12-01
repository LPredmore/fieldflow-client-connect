/**
 * Deprecation Warnings Utility
 * 
 * Centralized system for tracking and logging usage of deprecated fields
 * in development environments. Helps monitor migration progress from legacy
 * clinicians table flags to the user_roles table.
 */

interface DeprecationUsage {
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  contexts: Set<string>;
}

class DeprecationTracker {
  private usage: Map<string, DeprecationUsage> = new Map();
  private isDevelopment = import.meta.env.DEV;

  /**
   * Log a deprecation warning for a specific field
   */
  logDeprecation(
    field: string,
    context: string,
    migrationGuidance: string
  ): void {
    if (!this.isDevelopment) return;

    // Track usage statistics
    const existing = this.usage.get(field);
    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
      existing.contexts.add(context);
    } else {
      this.usage.set(field, {
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        contexts: new Set([context]),
      });
    }

    // Log the warning
    console.warn(
      `⚠️ DEPRECATED FIELD USAGE: ${field}`,
      `\n  Context: ${context}`,
      `\n  Migration: ${migrationGuidance}`,
      `\n  Usage Count: ${this.usage.get(field)!.count}`,
      `\n  Target Removal: v3.0.0`
    );
  }

  /**
   * Get usage statistics for all deprecated fields
   */
  getUsageStats(): Record<string, Omit<DeprecationUsage, 'contexts'> & { contexts: string[] }> {
    const stats: Record<string, Omit<DeprecationUsage, 'contexts'> & { contexts: string[] }> = {};
    
    this.usage.forEach((usage, field) => {
      stats[field] = {
        count: usage.count,
        firstSeen: usage.firstSeen,
        lastSeen: usage.lastSeen,
        contexts: Array.from(usage.contexts),
      };
    });

    return stats;
  }

  /**
   * Print a summary of all deprecated field usage
   */
  printSummary(): void {
    if (!this.isDevelopment || this.usage.size === 0) return;

    console.group('📊 Deprecated Field Usage Summary');
    this.usage.forEach((usage, field) => {
      console.log(
        `\n${field}:`,
        `\n  Total Uses: ${usage.count}`,
        `\n  First Seen: ${usage.firstSeen.toISOString()}`,
        `\n  Last Seen: ${usage.lastSeen.toISOString()}`,
        `\n  Contexts: ${Array.from(usage.contexts).join(', ')}`
      );
    });
    console.groupEnd();
  }
}

// Singleton instance
export const deprecationTracker = new DeprecationTracker();

/**
 * Predefined deprecation warnings for common fields
 */
export const deprecationWarnings = {
  clinicianIsAdmin: (context: string) => {
    deprecationTracker.logDeprecation(
      'clinicians.is_admin',
      context,
      'Use user_roles table with has_role(user_id, \'admin\') or UnifiedRoleDetectionService.detectUserRole()'
    );
  },

  clinicianIsClinician: (context: string) => {
    deprecationTracker.logDeprecation(
      'clinicians.is_clinician',
      context,
      'Use user_roles table with has_role(user_id, \'clinician\') or UnifiedRoleDetectionService.detectUserRole()'
    );
  },

  profileRole: (context: string) => {
    deprecationTracker.logDeprecation(
      'profiles.role',
      context,
      'Use user_roles table with UnifiedRoleDetectionService.detectUserRole() for authorization'
    );
  },
};

// Print summary on page unload in development
if (import.meta.env.DEV) {
  window.addEventListener('beforeunload', () => {
    deprecationTracker.printSummary();
  });
}
