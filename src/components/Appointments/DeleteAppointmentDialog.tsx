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
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
import type { DeleteScope } from '@/hooks/useRecurringAppointmentActions';

interface DeleteAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: DeleteScope) => void;
  isRecurring: boolean;
  isLoading?: boolean;
}

export function DeleteAppointmentDialog({
  open,
  onOpenChange,
  onConfirm,
  isRecurring,
  isLoading = false,
}: DeleteAppointmentDialogProps) {
  if (!isRecurring) {
    // Simple confirmation for non-recurring appointments
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Cancel Appointment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onConfirm('this_only')}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Cancelling...' : 'Cancel Appointment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Series delete options
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancel Recurring Appointment
          </AlertDialogTitle>
          <AlertDialogDescription>
            This appointment is part of a recurring series. Which appointments would you like to cancel?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            className="justify-start h-auto py-3 px-4 border-destructive/50 hover:bg-destructive/10"
            onClick={() => onConfirm('this_only')}
            disabled={isLoading}
          >
            <div className="text-left">
              <div className="font-medium">Only this appointment</div>
              <div className="text-sm text-muted-foreground">
                Cancel just this single occurrence
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3 px-4 border-destructive/50 hover:bg-destructive/10"
            onClick={() => onConfirm('this_and_future')}
            disabled={isLoading}
          >
            <div className="text-left">
              <div className="font-medium">This and all future appointments</div>
              <div className="text-sm text-muted-foreground">
                Cancel this and all future occurrences in the series
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3 px-4 border-destructive hover:bg-destructive/20"
            onClick={() => onConfirm('entire_series')}
            disabled={isLoading}
          >
            <div className="text-left">
              <div className="font-medium text-destructive">Cancel entire series</div>
              <div className="text-sm text-muted-foreground">
                Cancel all appointments in this recurring series
              </div>
            </div>
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Keep Appointments</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
