import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface RoleSyncStatus {
  user_id: string;
  full_name: string | null;
  email: string | null;
  has_staff_role: boolean | null;
  has_clinician_role: boolean | null;
  has_admin_role: boolean | null;
  sync_status: string | null;
}

export function RoleSyncDashboard() {
  const { data: syncStatus, isLoading, error } = useQuery({
    queryKey: ['role_sync_verification'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_sync_verification')
        .select('*')
        .order('full_name');

      if (error) throw error;
      return data as RoleSyncStatus[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load sync status: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const inSyncCount = syncStatus?.filter(s => s.sync_status === 'IN_SYNC').length || 0;
  const mismatchCount = syncStatus?.filter(s => s.sync_status !== 'IN_SYNC').length || 0;
  const totalCount = syncStatus?.length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Synchronization Status</CardTitle>
        <CardDescription>
          Monitors sync between clinicians table and user_roles table
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-muted-foreground">Total Users</div>
            <div className="text-2xl font-bold">{totalCount}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-muted-foreground">In Sync</div>
            <div className="text-2xl font-bold text-green-600">{inSyncCount}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-muted-foreground">Mismatched</div>
            <div className="text-2xl font-bold text-yellow-600">{mismatchCount}</div>
          </div>
        </div>

        {mismatchCount > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {mismatchCount} user(s) have mismatched roles. The database trigger will sync these on the next update.
            </AlertDescription>
          </Alert>
        )}

        {syncStatus && syncStatus.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">User Status</h4>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {syncStatus.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <div className="font-medium">{user.full_name || user.email}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.has_staff_role && (
                      <Badge variant="secondary">Staff</Badge>
                    )}
                    {user.has_clinician_role && (
                      <Badge variant="secondary">Clinician</Badge>
                    )}
                    {user.has_admin_role && (
                      <Badge variant="secondary">Admin</Badge>
                    )}
                    {user.sync_status === 'IN_SYNC' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
