import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, AlertCircle } from 'lucide-react';
import { PHQ9Assessment, GAD7Assessment, PCL5Assessment } from '@/hooks/useClientDetail';

interface ClientAssessmentsTabProps {
  loading: boolean;
  phq9Assessments: PHQ9Assessment[];
  gad7Assessments: GAD7Assessment[];
  pcl5Assessments: PCL5Assessment[];
}

export function ClientAssessmentsTab({
  loading,
  phq9Assessments,
  gad7Assessments,
  pcl5Assessments,
}: ClientAssessmentsTabProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    const lowerSeverity = severity?.toLowerCase() || '';
    if (lowerSeverity.includes('minimal') || lowerSeverity === 'none') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    }
    if (lowerSeverity.includes('mild')) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
    if (lowerSeverity.includes('moderate')) {
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    }
    if (lowerSeverity.includes('severe') || lowerSeverity.includes('high')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    }
    return 'bg-muted text-muted-foreground';
  };

  const hasNoAssessments = 
    phq9Assessments.length === 0 && 
    gad7Assessments.length === 0 && 
    pcl5Assessments.length === 0;

  if (hasNoAssessments) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No Assessments</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No standardized assessments have been completed for this client yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* PHQ-9 Assessments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            PHQ-9 (Depression)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {phq9Assessments.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>No PHQ-9 assessments recorded</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Clinician</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phq9Assessments.slice(0, 5).map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell>
                      {format(new Date(assessment.assessment_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {assessment.total_score}/27
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(assessment.severity)}>
                        {assessment.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{assessment.clinician_name_snapshot || 'Unknown'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GAD-7 Assessments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            GAD-7 (Anxiety)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gad7Assessments.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>No GAD-7 assessments recorded</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Clinician</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gad7Assessments.slice(0, 5).map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell>
                      {format(new Date(assessment.administered_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {assessment.total_score}/21
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(assessment.severity)}>
                        {assessment.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{assessment.clinician_name_snapshot || 'Unknown'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PCL-5 Assessments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            PCL-5 (PTSD)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pcl5Assessments.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>No PCL-5 assessments recorded</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Clinician</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pcl5Assessments.slice(0, 5).map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell>
                      {format(new Date(assessment.administered_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {assessment.total_score}/80
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(assessment.severity)}>
                        {assessment.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{assessment.clinician_name_snapshot || 'Unknown'}</TableCell>
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
