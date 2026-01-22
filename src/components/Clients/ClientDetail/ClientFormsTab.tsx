import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FileText, Eye, Plus, X, Clock, CheckCircle2 } from 'lucide-react';
import { FormResponseWithTemplate } from '@/hooks/useClientDetail';
import { ClientFormAssignment } from '@/hooks/useClientFormAssignments';
import { ConsentStatus } from '@/hooks/useClientConsentStatus';
import { ConsentStatusCard } from './ConsentStatusCard';

interface ClientFormsTabProps {
  loading: boolean;
  formResponses: FormResponseWithTemplate[];
  formAssignments: ClientFormAssignment[];
  assignmentsLoading: boolean;
  onViewResponse: (response: FormResponseWithTemplate) => void;
  onAssignForm: () => void;
  onCancelAssignment: (assignmentId: string) => void;
  // Consent status props
  consentStatuses: ConsentStatus[];
  consentLoading: boolean;
  signedCount: number;
  requiredCount: number;
  isFullyCompliant: boolean;
}

export function ClientFormsTab({
  loading,
  formResponses,
  formAssignments,
  assignmentsLoading,
  onViewResponse,
  onAssignForm,
  onCancelAssignment,
  consentStatuses,
  consentLoading,
  signedCount,
  requiredCount,
  isFullyCompliant,
}: ClientFormsTabProps) {
  const pendingAssignments = formAssignments.filter(a => a.status === 'pending');
  const isLoading = loading || assignmentsLoading;

  if (isLoading && consentLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const hasNoFormData = formResponses.length === 0 && pendingAssignments.length === 0;

  return (
    <div className="space-y-6">
      {/* Consent Status Section */}
      <ConsentStatusCard
        consentStatuses={consentStatuses}
        loading={consentLoading}
        signedCount={signedCount}
        requiredCount={requiredCount}
        isFullyCompliant={isFullyCompliant}
      />

      {/* Pending Assignments Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Forms
              {pendingAssignments.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingAssignments.length}
                </Badge>
              )}
            </CardTitle>
            <Button onClick={onAssignForm} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Assign Form
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendingAssignments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No pending form assignments.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Name</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      {assignment.form_template?.name || 'Unknown Form'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(assignment.assigned_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {assignment.due_at 
                        ? format(new Date(assignment.due_at), 'MMM d, yyyy')
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {assignment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancelAssignment(assignment.id)}
                        title="Cancel assignment"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Completed Forms Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Completed Forms
            {formResponses.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {formResponses.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {formResponses.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No completed form submissions yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Name</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formResponses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell className="font-medium">
                      {response.form_template?.name || 'Unknown Form'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(response.submitted_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewResponse(response)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
