import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Stethoscope, ClipboardList, Eye, AlertCircle, Printer, ChevronDown, ChevronUp, X } from 'lucide-react';
import { TreatmentPlan, ClientDiagnosis, SessionNote } from '@/hooks/useClientDetail';

interface ClientClinicalTabProps {
  loading: boolean;
  currentTreatmentPlan: TreatmentPlan | null;
  activeDiagnoses: ClientDiagnosis[];
  sessionNotes: SessionNote[];
  onViewTreatmentPlan: () => void;
  onViewSessionNote: (noteId: string) => void;
  onPrintSelectedNotes: (noteIds: string[]) => void;
}

export function ClientClinicalTab({
  loading,
  currentTreatmentPlan,
  activeDiagnoses,
  sessionNotes,
  onViewTreatmentPlan,
  onViewSessionNote,
  onPrintSelectedNotes,
}: ClientClinicalTabProps) {
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  // Memoize displayed notes
  const displayedNotes = useMemo(() => {
    return showAllNotes ? sessionNotes : sessionNotes.slice(0, 10);
  }, [sessionNotes, showAllNotes]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNoteIds(new Set(displayedNotes.map(note => note.id)));
    } else {
      setSelectedNoteIds(new Set());
    }
  };

  const handleSelectNote = (noteId: string, checked: boolean) => {
    const newSelected = new Set(selectedNoteIds);
    if (checked) {
      newSelected.add(noteId);
    } else {
      newSelected.delete(noteId);
    }
    setSelectedNoteIds(newSelected);
  };

  const handleClearSelection = () => {
    setSelectedNoteIds(new Set());
  };

  const handlePrintSelected = () => {
    onPrintSelectedNotes(Array.from(selectedNoteIds));
  };

  const isAllSelected = displayedNotes.length > 0 && displayedNotes.every(note => selectedNoteIds.has(note.id));
  const isSomeSelected = displayedNotes.some(note => selectedNoteIds.has(note.id));
  const hasMoreNotes = sessionNotes.length > 10;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const getPlanLengthLabel = (value: string | null) => {
    if (!value) return 'Not set';
    const labels: Record<string, string> = {
      '1month': '1 month',
      '3month': '3 months',
      '6month': '6 months',
      '9month': '9 months',
      '12month': '12 months',
    };
    return labels[value] || value;
  };

  const getFrequencyLabel = (value: string | null) => {
    if (!value) return 'Not set';
    const labels: Record<string, string> = {
      'weekly': 'Weekly',
      'biweekly': 'Bi-Weekly',
      'monthly': 'Monthly',
      'asneeded': 'As Needed',
    };
    return labels[value] || value;
  };

  return (
    <div className="space-y-6">
      {/* Active Diagnoses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Active Diagnoses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeDiagnoses.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>No active diagnoses recorded</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ICD-10 Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDiagnoses.map((diagnosis) => (
                  <TableRow key={diagnosis.id}>
                    <TableCell className="font-mono font-medium">
                      {diagnosis.diagnosis_code?.code || 'N/A'}
                    </TableCell>
                    <TableCell>{diagnosis.diagnosis_code?.description || 'Unknown'}</TableCell>
                    <TableCell>
                      {diagnosis.is_primary ? (
                        <Badge>Primary</Badge>
                      ) : (
                        <Badge variant="secondary">Secondary</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Current Treatment Plan */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Current Treatment Plan
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onViewTreatmentPlan}>
            <Eye className="h-4 w-4 mr-2" />
            {currentTreatmentPlan ? 'View/Edit' : 'Create'}
          </Button>
        </CardHeader>
        <CardContent>
          {!currentTreatmentPlan ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>No treatment plan created yet</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">
                  {currentTreatmentPlan.treatmentplan_startdate 
                    ? format(new Date(currentTreatmentPlan.treatmentplan_startdate), 'MMM d, yyyy')
                    : 'Not set'
                  }
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Plan Length</p>
                <p className="font-medium">{getPlanLengthLabel(currentTreatmentPlan.planlength)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Frequency</p>
                <p className="font-medium">{getFrequencyLabel(currentTreatmentPlan.treatmentfrequency)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Next Update</p>
                <p className="font-medium">
                  {currentTreatmentPlan.next_treatmentplan_update 
                    ? format(new Date(currentTreatmentPlan.next_treatmentplan_update), 'MMM d, yyyy')
                    : 'Not set'
                  }
                </p>
              </div>
              {currentTreatmentPlan.treatmentgoal && (
                <div className="col-span-full space-y-1">
                  <p className="text-sm text-muted-foreground">Treatment Goal</p>
                  <p className="font-medium">{currentTreatmentPlan.treatmentgoal}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Notes History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Session Notes History
            </CardTitle>
            {sessionNotes.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {sessionNotes.length} total notes
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sessionNotes.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>No session notes recorded yet</span>
            </div>
          ) : (
            <>
              {/* Selection Actions Bar */}
              {selectedNoteIds.size > 0 && (
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mb-4">
                  <span className="text-sm font-medium">
                    {selectedNoteIds.size} note{selectedNoteIds.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleClearSelection}>
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                    <Button size="sm" onClick={handlePrintSelected}>
                      <Printer className="h-4 w-4 mr-2" />
                      Print Selected
                    </Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all notes"
                        className={isSomeSelected && !isAllSelected ? 'opacity-50' : ''}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clinician</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedNotes.map((note) => {
                    const clinicianName = note.staff 
                      ? `${note.staff.prov_name_f || ''} ${note.staff.prov_name_l || ''}`.trim()
                      : 'Unknown';
                    const sessionDate = note.appointment?.start_at || note.created_at;
                    const isSelected = selectedNoteIds.has(note.id);
                    
                    return (
                      <TableRow key={note.id} className={isSelected ? 'bg-muted/30' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectNote(note.id, checked as boolean)}
                            aria-label={`Select note from ${format(new Date(sessionDate), 'MMM d, yyyy')}`}
                          />
                        </TableCell>
                        <TableCell>
                          {format(new Date(sessionDate), 'MMM d, yyyy h:mm a')}
                        </TableCell>
                        <TableCell>{clinicianName}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onViewSessionNote(note.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Show More/Less Toggle */}
              {hasMoreNotes && (
                <div className="mt-4 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAllNotes(!showAllNotes);
                      // Clear selection when toggling to avoid confusion
                      if (!showAllNotes) {
                        setSelectedNoteIds(new Set());
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showAllNotes ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Show all {sessionNotes.length} notes
                      </>
                    )}
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
