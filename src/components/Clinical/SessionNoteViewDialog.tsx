import { useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Calendar, 
  Stethoscope, 
  Brain, 
  FileText, 
  AlertTriangle,
  Target,
  ClipboardList,
  Printer
} from 'lucide-react';
import { SessionNote } from '@/hooks/useClientDetail';
import { SessionNotePrintDialog } from './SessionNotePrintDialog';

interface SessionNoteViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionNote: SessionNote | null;
}

export function SessionNoteViewDialog({
  open,
  onOpenChange,
  sessionNote,
}: SessionNoteViewDialogProps) {
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  if (!sessionNote) return null;

  const clinicianName = sessionNote.staff 
    ? `${sessionNote.staff.prov_name_f || ''} ${sessionNote.staff.prov_name_l || ''}`.trim()
    : 'Unknown';

  const sessionDate = sessionNote.appointment?.start_at || sessionNote.created_at;

  const getRiskBadgeVariant = (risk: string | null): "default" | "destructive" | "outline" | "secondary" => {
    switch (risk) {
      case 'high':
      case 'active':
        return 'destructive';
      case 'medium':
      case 'passive':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatRiskLabel = (risk: string | null) => {
    if (!risk || risk === 'none') return 'None';
    return risk.charAt(0).toUpperCase() + risk.slice(1);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Session Note
              </SheetTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowPrintDialog(true)}
                className="no-print"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
            <SheetDescription className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(sessionDate), 'MMMM d, yyyy h:mm a')}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {clinicianName}
              </span>
            </SheetDescription>
          </SheetHeader>

        <div className="space-y-6">
          {/* Diagnoses */}
          {sessionNote.client_diagnosis && sessionNote.client_diagnosis.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Diagnoses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {sessionNote.client_diagnosis.map((dx, index) => (
                    <Badge key={index} variant="secondary">{dx}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Treatment Objectives (Read-only snapshot) */}
          {(sessionNote.client_primaryobjective || sessionNote.client_secondaryobjective || sessionNote.client_tertiaryobjective) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Treatment Objectives
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sessionNote.client_primaryobjective && (
                  <div>
                    <p className="text-sm text-muted-foreground">Primary Objective</p>
                    <p className="font-medium">{sessionNote.client_primaryobjective}</p>
                  </div>
                )}
                {sessionNote.client_secondaryobjective && (
                  <div>
                    <p className="text-sm text-muted-foreground">Secondary Objective</p>
                    <p className="font-medium">{sessionNote.client_secondaryobjective}</p>
                  </div>
                )}
                {sessionNote.client_tertiaryobjective && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tertiary Objective</p>
                    <p className="font-medium">{sessionNote.client_tertiaryobjective}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mental Status Exam */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Mental Status Examination
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sessionNote.client_appearance && (
                  <div>
                    <p className="text-sm text-muted-foreground">Appearance</p>
                    <p className="font-medium">{sessionNote.client_appearance}</p>
                  </div>
                )}
                {sessionNote.client_attitude && (
                  <div>
                    <p className="text-sm text-muted-foreground">Attitude</p>
                    <p className="font-medium">{sessionNote.client_attitude}</p>
                  </div>
                )}
                {sessionNote.client_behavior && (
                  <div>
                    <p className="text-sm text-muted-foreground">Behavior</p>
                    <p className="font-medium">{sessionNote.client_behavior}</p>
                  </div>
                )}
                {sessionNote.client_speech && (
                  <div>
                    <p className="text-sm text-muted-foreground">Speech</p>
                    <p className="font-medium">{sessionNote.client_speech}</p>
                  </div>
                )}
                {sessionNote.client_affect && (
                  <div>
                    <p className="text-sm text-muted-foreground">Affect</p>
                    <p className="font-medium">{sessionNote.client_affect}</p>
                  </div>
                )}
                {sessionNote.client_mood && (
                  <div>
                    <p className="text-sm text-muted-foreground">Mood</p>
                    <p className="font-medium">{sessionNote.client_mood}</p>
                  </div>
                )}
                {sessionNote.client_thoughtprocess && (
                  <div>
                    <p className="text-sm text-muted-foreground">Thought Process</p>
                    <p className="font-medium">{sessionNote.client_thoughtprocess}</p>
                  </div>
                )}
                {sessionNote.client_perception && (
                  <div>
                    <p className="text-sm text-muted-foreground">Perception</p>
                    <p className="font-medium">{sessionNote.client_perception}</p>
                  </div>
                )}
                {sessionNote.client_orientation && (
                  <div>
                    <p className="text-sm text-muted-foreground">Orientation</p>
                    <p className="font-medium">{sessionNote.client_orientation}</p>
                  </div>
                )}
                {sessionNote.client_memoryconcentration && (
                  <div>
                    <p className="text-sm text-muted-foreground">Memory/Concentration</p>
                    <p className="font-medium">{sessionNote.client_memoryconcentration}</p>
                  </div>
                )}
                {sessionNote.client_insightjudgement && (
                  <div>
                    <p className="text-sm text-muted-foreground">Insight/Judgement</p>
                    <p className="font-medium">{sessionNote.client_insightjudgement}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Suicidal Ideation</p>
                  <Badge variant={getRiskBadgeVariant(sessionNote.client_suicidalideation)}>
                    {formatRiskLabel(sessionNote.client_suicidalideation)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Homicidal Ideation</p>
                  <Badge variant={getRiskBadgeVariant(sessionNote.client_homicidalideation)}>
                    {formatRiskLabel(sessionNote.client_homicidalideation)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Substance Abuse Risk</p>
                  <Badge variant={getRiskBadgeVariant(sessionNote.client_substanceabuserisk)}>
                    {formatRiskLabel(sessionNote.client_substanceabuserisk)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session Narrative */}
          {sessionNote.client_sessionnarrative && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Session Narrative
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{sessionNote.client_sessionnarrative}</p>
              </CardContent>
            </Card>
          )}

          {/* Clinical Assessment */}
          {(sessionNote.client_functioning || sessionNote.client_prognosis || sessionNote.client_progress) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Clinical Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sessionNote.client_functioning && (
                  <div>
                    <p className="text-sm text-muted-foreground">Functioning</p>
                    <p className="font-medium">{sessionNote.client_functioning}</p>
                  </div>
                )}
                {sessionNote.client_prognosis && (
                  <div>
                    <p className="text-sm text-muted-foreground">Prognosis</p>
                    <p className="font-medium">{sessionNote.client_prognosis}</p>
                  </div>
                )}
                {sessionNote.client_progress && (
                  <div>
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="font-medium">{sessionNote.client_progress}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Interventions */}
          {(sessionNote.client_intervention1 || sessionNote.client_intervention2 || sessionNote.client_intervention3) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Interventions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {sessionNote.client_intervention1 && (
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-medium">1.</span>
                      <span>{sessionNote.client_intervention1}</span>
                    </li>
                  )}
                  {sessionNote.client_intervention2 && (
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-medium">2.</span>
                      <span>{sessionNote.client_intervention2}</span>
                    </li>
                  )}
                  {sessionNote.client_intervention3 && (
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-medium">3.</span>
                      <span>{sessionNote.client_intervention3}</span>
                    </li>
                  )}
                  {sessionNote.client_intervention4 && (
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-medium">4.</span>
                      <span>{sessionNote.client_intervention4}</span>
                    </li>
                  )}
                  {sessionNote.client_intervention5 && (
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-medium">5.</span>
                      <span>{sessionNote.client_intervention5}</span>
                    </li>
                  )}
                  {sessionNote.client_intervention6 && (
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-medium">6.</span>
                      <span>{sessionNote.client_intervention6}</span>
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Medications & Attendance */}
          {(sessionNote.client_medications || sessionNote.client_personsinattendance) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sessionNote.client_personsinattendance && (
                  <div>
                    <p className="text-sm text-muted-foreground">Persons in Attendance</p>
                    <p className="font-medium">{sessionNote.client_personsinattendance}</p>
                  </div>
                )}
                {sessionNote.client_medications && (
                  <div>
                    <p className="text-sm text-muted-foreground">Medications</p>
                    <p className="font-medium">{sessionNote.client_medications}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>

    <SessionNotePrintDialog
      open={showPrintDialog}
      onOpenChange={setShowPrintDialog}
      noteId={sessionNote.id}
      clientId={sessionNote.client_id}
    />
  </>
  );
}
