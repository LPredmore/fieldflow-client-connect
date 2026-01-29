import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, AlertCircle, TableIcon, LineChart } from 'lucide-react';
import { PHQ9Assessment, GAD7Assessment, PCL5Assessment } from '@/hooks/useClientDetail';
import { AssessmentTrendChart } from './AssessmentTrendChart';

type ViewMode = 'table' | 'chart';

interface ClientAssessmentsTabProps {
  loading: boolean;
  phq9Assessments: PHQ9Assessment[];
  gad7Assessments: GAD7Assessment[];
  pcl5Assessments: PCL5Assessment[];
}

// Clinical thresholds for each assessment type
const PHQ9_THRESHOLDS = [
  { value: 5, label: 'Mild', color: '#eab308' },
  { value: 10, label: 'Moderate', color: '#f97316' },
  { value: 15, label: 'Mod. Severe', color: '#ef4444' },
  { value: 20, label: 'Severe', color: '#dc2626' },
];

const GAD7_THRESHOLDS = [
  { value: 5, label: 'Mild', color: '#eab308' },
  { value: 10, label: 'Moderate', color: '#f97316' },
  { value: 15, label: 'Severe', color: '#ef4444' },
];

const PCL5_THRESHOLDS = [
  { value: 31, label: 'PTSD Cutoff', color: '#ef4444' },
];

export function ClientAssessmentsTab({
  loading,
  phq9Assessments,
  gad7Assessments,
  pcl5Assessments,
}: ClientAssessmentsTabProps) {
  // View mode states for each assessment type
  const [phq9ViewMode, setPhq9ViewMode] = useState<ViewMode>('table');
  const [gad7ViewMode, setGad7ViewMode] = useState<ViewMode>('table');
  const [pcl5ViewMode, setPcl5ViewMode] = useState<ViewMode>('table');

  // Show all toggles for each assessment type
  const [showAllPhq9, setShowAllPhq9] = useState(false);
  const [showAllGad7, setShowAllGad7] = useState(false);
  const [showAllPcl5, setShowAllPcl5] = useState(false);

  // Displayed assessments based on showAll state
  const displayedPhq9 = showAllPhq9 ? phq9Assessments : phq9Assessments.slice(0, 5);
  const displayedGad7 = showAllGad7 ? gad7Assessments : gad7Assessments.slice(0, 5);
  const displayedPcl5 = showAllPcl5 ? pcl5Assessments : pcl5Assessments.slice(0, 5);

  // Chart data transformations - use assessment_date with administered_at fallback
  const phq9ChartData = useMemo(() =>
    phq9Assessments.map(a => ({
      date: a.assessment_date || a.administered_at,
      score: a.total_score,
    })),
    [phq9Assessments]
  );

  const gad7ChartData = useMemo(() =>
    gad7Assessments.map(a => ({
      date: a.administered_at,
      score: a.total_score,
    })),
    [gad7Assessments]
  );

  const pcl5ChartData = useMemo(() =>
    pcl5Assessments.map(a => ({
      date: a.assessment_date || a.administered_at,
      score: a.total_score,
    })),
    [pcl5Assessments]
  );

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
    if (lowerSeverity.includes('severe') || lowerSeverity.includes('high') || lowerSeverity.includes('probable') || lowerSeverity.includes('ptsd')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    }
    if (lowerSeverity.includes('below') || lowerSeverity.includes('cutoff')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    }
    return 'bg-muted text-muted-foreground';
  };

  // Helper to derive PCL-5 severity from boolean
  const getPcl5Severity = (meetsCutoff: boolean): string => {
    return meetsCutoff ? 'Probable PTSD' : 'Below Cutoff';
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

  const ViewModeToggle = ({ viewMode, setViewMode }: { viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }) => (
    <div className="flex items-center gap-1">
      <Button
        variant={viewMode === 'table' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('table')}
        className="h-7 px-2"
      >
        <TableIcon className="h-3.5 w-3.5 mr-1" />
        Table
      </Button>
      <Button
        variant={viewMode === 'chart' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('chart')}
        className="h-7 px-2"
      >
        <LineChart className="h-3.5 w-3.5 mr-1" />
        Chart
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* PHQ-9 Assessments */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              PHQ-9 (Depression)
            </CardTitle>
            {phq9Assessments.length > 0 && (
              <ViewModeToggle viewMode={phq9ViewMode} setViewMode={setPhq9ViewMode} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {phq9Assessments.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>No PHQ-9 assessments recorded</span>
            </div>
          ) : phq9ViewMode === 'chart' ? (
            <AssessmentTrendChart
              data={phq9ChartData}
              maxScore={27}
              label="PHQ-9 Score"
              thresholds={PHQ9_THRESHOLDS}
            />
          ) : (
            <>
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
                  {displayedPhq9.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell>
                        {format(new Date(assessment.assessment_date || assessment.administered_at), 'MMM d, yyyy')}
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
              {phq9Assessments.length > 5 && (
                <div className="mt-3 text-center">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowAllPhq9(!showAllPhq9)}
                  >
                    {showAllPhq9 ? 'Show less' : `View all ${phq9Assessments.length} assessments`}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* GAD-7 Assessments */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              GAD-7 (Anxiety)
            </CardTitle>
            {gad7Assessments.length > 0 && (
              <ViewModeToggle viewMode={gad7ViewMode} setViewMode={setGad7ViewMode} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {gad7Assessments.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>No GAD-7 assessments recorded</span>
            </div>
          ) : gad7ViewMode === 'chart' ? (
            <AssessmentTrendChart
              data={gad7ChartData}
              maxScore={21}
              label="GAD-7 Score"
              thresholds={GAD7_THRESHOLDS}
            />
          ) : (
            <>
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
                  {displayedGad7.map((assessment) => (
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
              {gad7Assessments.length > 5 && (
                <div className="mt-3 text-center">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowAllGad7(!showAllGad7)}
                  >
                    {showAllGad7 ? 'Show less' : `View all ${gad7Assessments.length} assessments`}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* PCL-5 Assessments */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              PCL-5 (PTSD)
            </CardTitle>
            {pcl5Assessments.length > 0 && (
              <ViewModeToggle viewMode={pcl5ViewMode} setViewMode={setPcl5ViewMode} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pcl5Assessments.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>No PCL-5 assessments recorded</span>
            </div>
          ) : pcl5ViewMode === 'chart' ? (
            <AssessmentTrendChart
              data={pcl5ChartData}
              maxScore={80}
              label="PCL-5 Score"
              thresholds={PCL5_THRESHOLDS}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clinician</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedPcl5.map((assessment) => {
                    const severity = getPcl5Severity(assessment.meets_ptsd_cutoff);
                    return (
                      <TableRow key={assessment.id}>
                        <TableCell>
                          {format(new Date(assessment.assessment_date || assessment.administered_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          {assessment.total_score}/80
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(severity)}>
                            {severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{assessment.clinician_name_snapshot || 'Unknown'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {pcl5Assessments.length > 5 && (
                <div className="mt-3 text-center">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowAllPcl5(!showAllPcl5)}
                  >
                    {showAllPcl5 ? 'Show less' : `View all ${pcl5Assessments.length} assessments`}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
