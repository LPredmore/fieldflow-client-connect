import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Archive, RefreshCw } from "lucide-react";
import { Profile } from '@/hooks/useProfiles';
import { format } from 'date-fns';

interface ArchivedUsersViewProps {
  profiles: Profile[];
  onRestore: (profileId: string) => void;
}

export function ArchivedUsersView({ profiles, onRestore }: ArchivedUsersViewProps) {
  const archivedUsers = useMemo(() => {
    return profiles.filter(p => p.archived && p.role === 'staff');
  }, [profiles]);

  if (archivedUsers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archived Users
          </CardTitle>
          <CardDescription>
            View and restore archived team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No archived users</p>
            <p className="text-sm text-muted-foreground">
              Archived users will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Archived Users
        </CardTitle>
        <CardDescription>
          View and restore archived team members ({archivedUsers.length} archived)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Archived Date</TableHead>
                <TableHead>Archived By</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archivedUsers.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs font-medium text-muted-foreground">
                          {(profile.full_name || profile.email || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {profile.full_name || 'Unnamed User'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {profile.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {profile.archived_at ? (
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(profile.archived_at), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      Admin
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRestore(profile.id)}
                      className="h-8"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
