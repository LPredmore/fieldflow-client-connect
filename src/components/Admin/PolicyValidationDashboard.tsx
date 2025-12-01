import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { usePolicyValidationStatus, ValidationReport } from '@/utils/automatedPolicyValidator';
import { AlertTriangle, CheckCircle, Clock, Play, RefreshCw, Shield } from 'lucide-react';

/**
 * Dashboard component for automated policy validation
 * Shows validation status, results, and allows manual validation runs
 */
export function PolicyValidationDashboard() {
  const { isRunning, lastReport, runValidationNow } = usePolicyValidationStatus();
  const [isValidating, setIsValidating] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const handleManualValidation = async () => {
    setIsValidating(true);
    setValidationError(null);
    
    try {
      await runValidationNow();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusColor = (isValid: boolean, hasCircularDep: boolean) => {
    if (!isValid || hasCircularDep) return 'destructive';
    return 'default';
  };

  const getPerformanceColor = (score: string) => {
    switch (score) {
      case 'CRITICAL': return 'destructive';
      case 'WARNING': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Policy Validation Dashboard</h2>
        <div className="flex items-center gap-4">
          <Badge variant={isRunning ? 'default' : 'secondary'} className="flex items-center gap-2">
            {isRunning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
            {isRunning ? 'Auto-validation Running' : 'Auto-validation Stopped'}
          </Badge>
          <Button 
            onClick={handleManualValidation} 
            disabled={isValidating}
            className="flex items-center gap-2"
          >
            {isValidating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isValidating ? 'Validating...' : 'Run Validation Now'}
          </Button>
        </div>
      </div>

      {validationError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Validation Error: {validationError}
          </AlertDescription>
        </Alert>
      )}

      {lastReport && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lastReport.totalPolicies}</div>
                <p className="text-xs text-muted-foreground">
                  Last checked: {lastReport.timestamp.toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valid Policies</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{lastReport.validPolicies}</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round((lastReport.validPolicies / lastReport.totalPolicies) * 100)}% success rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Circular Dependencies</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{lastReport.circularDependencies}</div>
                <Badge variant={lastReport.circularDependencies > 0 ? 'destructive' : 'default'} className="text-xs mt-1">
                  {lastReport.circularDependencies > 0 ? 'Critical' : 'Good'}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Performance Issues</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{lastReport.performanceIssues}</div>
                <p className="text-xs text-muted-foreground">Slow or failing policies</p>
              </CardContent>
            </Card>
          </div>

          {/* Critical Issues Alert */}
          {lastReport.criticalIssues.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">
                    {lastReport.criticalIssues.length} Critical Issues Found
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {lastReport.criticalIssues.slice(0, 3).map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                    {lastReport.criticalIssues.length > 3 && (
                      <li>... and {lastReport.criticalIssues.length - 3} more issues</li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Detailed Results */}
          <Card>
            <CardHeader>
              <CardTitle>Policy Validation Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lastReport.results.map((result, index) => (
                  <div key={`${result.tableName}-${result.policyName}`} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium">{result.policyName}</div>
                        <div className="text-sm text-muted-foreground">Table: {result.tableName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor(result.isValid, result.hasCircularDependency)}>
                          {result.isValid ? 'Valid' : 'Invalid'}
                        </Badge>
                        <Badge variant={getPerformanceColor(result.performanceScore)}>
                          {result.performanceScore}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Execution Time:</span> {result.executionTime}ms
                      </div>
                      <div>
                        <span className="font-medium">Circular Dependency:</span>{' '}
                        <Badge variant={result.hasCircularDependency ? 'destructive' : 'default'} className="text-xs">
                          {result.hasCircularDependency ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-medium">Status:</span>{' '}
                        {result.isValid ? (
                          <span className="text-green-600">✓ Valid</span>
                        ) : (
                          <span className="text-red-600">✗ Invalid</span>
                        )}
                      </div>
                    </div>

                    {result.errorMessage && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        <strong>Error:</strong> {result.errorMessage}
                      </div>
                    )}

                    {result.recommendations.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm font-medium mb-1">Recommendations:</div>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {result.recommendations.map((rec, recIndex) => (
                            <li key={recIndex}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Validation Guidelines */}
          <Card>
            <CardHeader>
              <CardTitle>Policy Validation Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 border rounded-lg">
                  <div className="font-medium text-green-600 mb-2">✓ Good Practices</div>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Use direct auth.uid() comparisons</li>
                    <li>• Keep policies simple and focused</li>
                    <li>• Avoid cross-table references</li>
                    <li>• Execution time &lt; 1000ms</li>
                  </ul>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="font-medium text-orange-600 mb-2">⚠ Warning Signs</div>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Execution time 1000-2000ms</li>
                    <li>• Complex nested subqueries</li>
                    <li>• Multiple table joins in policies</li>
                    <li>• Inconsistent performance</li>
                  </ul>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="font-medium text-red-600 mb-2">✗ Critical Issues</div>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Circular dependencies detected</li>
                    <li>• Execution time &gt; 2000ms</li>
                    <li>• Policy evaluation failures</li>
                    <li>• Infinite recursion errors</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!lastReport && (
        <Card>
          <CardContent className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium mb-2">No Validation Results</div>
            <p className="text-muted-foreground mb-4">
              Run a validation check to see policy health and performance metrics
            </p>
            <Button onClick={handleManualValidation} disabled={isValidating}>
              {isValidating ? 'Running...' : 'Run First Validation'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}