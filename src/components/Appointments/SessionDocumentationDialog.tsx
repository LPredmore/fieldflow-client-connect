import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StaffAppointment } from '@/hooks/useStaffAppointments';
import { useTreatmentPlans } from '@/hooks/useTreatmentPlans';
import { FileText, AlertTriangle, Loader2 } from 'lucide-react';

export type CancellationType = 'cancelled' | 'late_cancel/noshow';

interface SessionDocumentationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: StaffAppointment | null;
  onSessionOccurred: (appointmentId: string) => void;
  onSessionNotOccurred: (
    appointmentId: string,
    cancellationType: CancellationType,
    notes: string
  ) => Promise<void>;
  onOpenSessionNote?: (appointment: StaffAppointment) => void;
  onOpenTreatmentPlan?: (clientId: string, clientName: string) => void;
}

export function SessionDocumentationDialog({
  open,
  onOpenChange,
  appointment,
  onSessionOccurred,
  onSessionNotOccurred,
  onOpenSessionNote,
  onOpenTreatmentPlan,
}: SessionDocumentationDialogProps) {
  // UI phase: 'initial' = asking if session occurred, 'cancellation' = selecting cancellation type, 'session_options' = showing session note options
  const [phase, setPhase] = useState<'initial' | 'cancellation' | 'session_options'>('initial');
  const [cancellationType, setCancellationType] = useState<CancellationType | ''>('');
  const [notes, setNotes] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for active treatment plan
  const { activePlan, loading: planLoading } = useTreatmentPlans(appointment?.client_id);

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPhase('initial');
      setCancellationType('');
      setNotes('');
      setShowConfirmation(false);
      setIsSubmitting(false);
    }
    onOpenChange(newOpen);
  };

  const handleYesClick = () => {
    // Instead of immediately closing, show session options phase
    setPhase('session_options');
  };

  const handleNoClick = () => {
    setPhase('cancellation');
  };

  const handleSubmitCancellation = () => {
    if (!cancellationType) return;
    setShowConfirmation(true);
  };

  const handleConfirmCancellation = async () => {
    if (!appointment || !cancellationType) return;
    
    setIsSubmitting(true);
    try {
      await onSessionNotOccurred(appointment.id, cancellationType, notes);
      setShowConfirmation(false);
      handleOpenChange(false);
    } catch (error) {
      console.error('[SessionDocumentationDialog] Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (phase === 'session_options') {
      setPhase('initial');
    } else {
      setPhase('initial');
      setCancellationType('');
      setNotes('');
    }
  };

  const handleCompleteSessionNote = () => {
    if (appointment && onOpenSessionNote) {
      handleOpenChange(false);
      onOpenSessionNote(appointment);
    }
  };

  const handleCreateTreatmentPlan = () => {
    if (appointment && onOpenTreatmentPlan) {
      handleOpenChange(false);
      onOpenTreatmentPlan(appointment.client_id, appointment.client_name);
    }
  };

  if (!appointment) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Document Session</DialogTitle>
            <DialogDescription>
              {appointment.client_name} • {appointment.display_date} at {appointment.display_time}
            </DialogDescription>
          </DialogHeader>

          {phase === 'initial' ? (
            <div className="space-y-6 py-4">
              <p className="text-sm text-foreground font-medium">
                Did this session occur?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleYesClick}
                >
                  Yes
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleNoClick}
                >
                  No
                </Button>
              </div>
            </div>
          ) : phase === 'session_options' ? (
            <div className="space-y-6 py-4">
              {planLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activePlan ? (
                // Has active treatment plan - show session note button
                <div className="space-y-4">
                  <p className="text-sm text-foreground font-medium">
                    Session confirmed. Would you like to complete the session note?
                  </p>
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={handleCompleteSessionNote}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Complete Session Note
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => handleOpenChange(false)}
                  >
                    Complete Later
                  </Button>
                </div>
              ) : (
                // No active treatment plan - show warning and create plan button
                <div className="space-y-4">
                  <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                      Client must have an active Treatment Plan before creating a session note.
                    </AlertDescription>
                  </Alert>
                  
                  <Button
                    variant="default"
                    className="w-full opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Complete Session Note
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCreateTreatmentPlan}
                  >
                    Create Treatment Plan
                  </Button>
                  
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => handleOpenChange(false)}
                  >
                    Complete Later
                  </Button>
                </div>
              )}
              
              <Button
                variant="link"
                className="w-full text-muted-foreground"
                onClick={handleBack}
              >
                ← Back
              </Button>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <p className="text-sm text-foreground font-medium">
                  What happened with this appointment?
                </p>
                <RadioGroup
                  value={cancellationType}
                  onValueChange={(value) => setCancellationType(value as CancellationType)}
                >
                  <div className="flex items-center space-x-3 p-3 rounded-md border border-border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="cancelled" id="cancelled" />
                    <Label htmlFor="cancelled" className="flex-1 cursor-pointer">
                      <span className="font-medium">Cancelled</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Session was cancelled in advance (no charge)
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-md border border-border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="late_cancel/noshow" id="late_cancel" />
                    <Label htmlFor="late_cancel" className="flex-1 cursor-pointer">
                      <span className="font-medium">Late Cancel / No Show</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Client cancelled late or did not attend ($25 fee)
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any relevant notes about this cancellation..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  variant="default"
                  onClick={handleSubmitCancellation}
                  disabled={!cancellationType}
                  className="flex-1"
                >
                  Submit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation AlertDialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. The appointment status will be changed to{' '}
              <span className="font-medium">
                {cancellationType === 'cancelled' ? 'Cancelled' : 'Late Cancel/No Show'}
              </span>
              {cancellationType === 'late_cancel/noshow' && (
                <span> and a $25 fee will be applied</span>
              )}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancellation}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
