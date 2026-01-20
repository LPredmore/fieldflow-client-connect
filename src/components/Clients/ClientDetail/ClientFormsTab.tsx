import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Eye, AlertCircle } from 'lucide-react';
import { FormResponseWithTemplate } from '@/hooks/useClientDetail';

interface ClientFormsTabProps {
  loading: boolean;
  formResponses: FormResponseWithTemplate[];
  onViewResponse: (response: FormResponseWithTemplate) => void;
}

export function ClientFormsTab({
  loading,
  formResponses,
  onViewResponse,
}: ClientFormsTabProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (formResponses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No Form Responses</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This client has not submitted any forms yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Submitted Forms
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form Name</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-[100px]">Action</TableHead>
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
      </CardContent>
    </Card>
  );
}
