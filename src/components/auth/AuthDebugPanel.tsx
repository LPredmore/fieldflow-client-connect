/**
 * Authentication Debug Panel
 * 
 * Development-only component that displays authentication state,
 * cache contents, circuit breaker status, and provides manual controls.
 * 
 * Requirements: 7.5, 7.6
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthenticationContext';
import { supabase } from '@/integrations/supabase/client';
import { sessionCacheService } from '@/services/auth/SessionCacheService';
import { queryDeduplicator } from '@/services/auth/QueryDeduplicator';
import { authLogger, AuthLogCategory } from '@/services/auth/AuthLogger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, RefreshCw, Trash2, Download, AlertCircle, Shield, AlertTriangle } from 'lucide-react';

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  tenant_id: string;
  is_active: boolean;
  granted_at: string;
  granted_by_user_id: string | null;
  expires_at: string | null;
}

export function AuthDebugPanel() {
  // Only render in development
  if (!import.meta.env.DEV) {
    return null;
  }

  const { user, isLoading, error, refreshUserData, resetAuth } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [cacheStats, setCacheStats] = useState(sessionCacheService.getStats());
  const [pendingQueries, setPendingQueries] = useState<string[]>([]);
  const [logs, setLogs] = useState(authLogger.getHistory());
  const [selectedCategory, setSelectedCategory] = useState<AuthLogCategory | 'all'>('all');
  const [activeRoles, setActiveRoles] = useState<UserRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Update stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setCacheStats(sessionCacheService.getStats());
      setPendingQueries(queryDeduplicator.getPendingKeys());
      setLogs(authLogger.getHistory());
    }, 1000);

    return () => clearInterval(interval);
  }, []);


  // Fetch active roles from user_roles table
  useEffect(() => {
    const fetchActiveRoles = async () => {
      if (!user?.id) {
        setActiveRoles([]);
        return;
      }

      setRolesLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('granted_at', { ascending: false });

        if (error) {
          console.error('Failed to fetch user roles:', error);
          setActiveRoles([]);
        } else {
          setActiveRoles(data || []);
        }
      } catch (err) {
        console.error('Error fetching user roles:', err);
        setActiveRoles([]);
      } finally {
        setRolesLoading(false);
      }
    };

    if (isOpen) {
      fetchActiveRoles();
    }
  }, [user?.id, isOpen]);

  const handleRefresh = async () => {
    try {
      await refreshUserData();
    } catch (err) {
      console.error('Failed to refresh user data:', err);
    }
  };

  const handleReset = async () => {
    try {
      await resetAuth();
    } catch (err) {
      console.error('Failed to reset auth:', err);
    }
  };

  const handleClearCache = () => {
    sessionCacheService.clear();
    setCacheStats(sessionCacheService.getStats());
  };

  const handleClearLogs = () => {
    authLogger.clearHistory();
    setLogs([]);
  };

  const handleExportLogs = () => {
    const logsJson = authLogger.exportLogs();
    const blob = new Blob([logsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auth-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const getRoleBadgeVariant = (role: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'clinician': return 'default';
      case 'staff': return 'secondary';
      case 'client': return 'outline';
      default: return 'outline';
    }
  };

  const filteredLogs = selectedCategory === 'all'
    ? logs
    : logs.filter(log => log.category === selectedCategory);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-2xl">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="shadow-lg border-2 border-primary">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Auth Debug Panel
                </CardTitle>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
              {/* Active Roles - Source of Truth */}
              <div className="space-y-2 border-2 border-primary rounded-lg p-3">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <Shield className="h-4 w-4" />
                  Active Roles (Source of Truth)
                  <Badge variant="default" className="ml-auto">user_roles table</Badge>
                </h3>
                <div className="text-xs bg-primary/5 p-2 rounded">
                  {rolesLoading ? (
                    <div className="text-muted-foreground">Loading roles...</div>
                  ) : activeRoles.length > 0 ? (
                    <div className="space-y-2">
                      {activeRoles.map((role) => (
                        <div key={role.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={getRoleBadgeVariant(role.role)}>
                                {role.role}
                              </Badge>
                              {role.is_active && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Granted: {new Date(role.granted_at).toLocaleDateString()}
                            </div>
                            {role.expires_at && (
                              <div className="text-xs text-muted-foreground">
                                Expires: {new Date(role.expires_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">No active roles found</div>
                  )}
                </div>
              </div>

              {/* User State */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">User State</h3>
                <div className="text-xs font-mono bg-muted p-2 rounded">
                  {isLoading ? (
                    <div>Loading...</div>
                  ) : user ? (
                    <div className="space-y-1">
                      <div><span className="text-muted-foreground">ID:</span> {user.id}</div>
                      <div><span className="text-muted-foreground">Email:</span> {user.email}</div>
                      <div><span className="text-muted-foreground">Role:</span> {user.role}</div>
                    </div>
                  ) : (
                    <div>Not authenticated</div>
                  )}
                  {error && (
                    <div className="mt-2 text-red-500">
                      <span className="text-muted-foreground">Error:</span> {error.message}
                    </div>
                  )}
                </div>
              </div>

              {/* Legacy Flags - For Reference Only */}
              {user?.staffAttributes && (
                <div className="space-y-2 opacity-60 border border-muted rounded-lg p-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Legacy Flags (clinicians table)
                    <Badge variant="destructive" className="ml-auto text-xs">
                      ⚠️ Reference Only
                    </Badge>
                  </h3>
                  <div className="text-xs font-mono bg-muted/50 p-2 rounded space-y-1">
                    <div className="text-xs text-destructive mb-2 font-semibold">
                      NOT used for authorization
                    </div>
                    <div className="line-through">
                      <span className="text-muted-foreground">is_clinician:</span> {user.staffAttributes.is_clinician ? 'true' : 'false'}
                    </div>
                    <div className="line-through">
                      <span className="text-muted-foreground">is_admin:</span> {user.staffAttributes.is_admin ? 'true' : 'false'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 italic">
                      Use user_roles table or UnifiedRoleDetectionService instead
                    </div>
                  </div>
                </div>
              )}


              {/* Cache Stats */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Cache</h3>
                <div className="text-xs font-mono bg-muted p-2 rounded space-y-1">
                  <div><span className="text-muted-foreground">Items:</span> {cacheStats.memoryCacheSize}</div>
                  {cacheStats.keys.length > 0 && (
                    <div className="mt-2">
                      <div className="text-muted-foreground mb-1">Keys:</div>
                      <div className="space-y-0.5">
                        {cacheStats.keys.map(key => (
                          <div key={key} className="text-xs truncate">• {key}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Queries */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Pending Queries</h3>
                <div className="text-xs font-mono bg-muted p-2 rounded">
                  {pendingQueries.length === 0 ? (
                    <div className="text-muted-foreground">No pending queries</div>
                  ) : (
                    <div className="space-y-0.5">
                      {pendingQueries.map(key => (
                        <div key={key} className="text-xs truncate">• {key}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Logs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Logs ({filteredLogs.length})</h3>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExportLogs}
                      className="h-6 text-xs"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearLogs}
                      className="h-6 text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
                
                {/* Category Filter */}
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory('all')}
                    className="h-6 text-xs"
                  >
                    All
                  </Button>
                  {Object.values(AuthLogCategory).map(category => (
                    <Button
                      key={category}
                      size="sm"
                      variant={selectedCategory === category ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(category)}
                      className="h-6 text-xs"
                    >
                      {category}
                    </Button>
                  ))}
                </div>

                <div className="text-xs font-mono bg-muted p-2 rounded max-h-48 overflow-y-auto space-y-1">
                  {filteredLogs.length === 0 ? (
                    <div className="text-muted-foreground">No logs</div>
                  ) : (
                    filteredLogs.slice(-20).reverse().map((log, index) => (
                      <div key={index} className="border-b border-border pb-1 mb-1 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs">
                            {log.category}
                          </span>
                          {log.userId && (
                            <span className="text-muted-foreground text-xs">
                              [{log.userId.slice(0, 8)}]
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">{log.message}</div>
                        {log.data && Object.keys(log.data).length > 0 && (
                          <div className="mt-0.5 text-muted-foreground">
                            {JSON.stringify(log.data, null, 2)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={handleRefresh}
                    disabled={!user || isLoading}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh User Data
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReset}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reset Auth
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearCache}
                    className="text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear Cache
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
