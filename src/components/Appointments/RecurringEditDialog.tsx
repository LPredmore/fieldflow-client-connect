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
import { Repeat } from 'lucide-react';
import type { EditScope } from '@/hooks/useRecurringAppointmentActions';

interface RecurringEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (scope: EditScope) => void;
  isLoading?: boolean;
}

export function RecurringEditDialog({
  open,
  onOpenChange,
  onSelect,
  isLoading = false,
}: RecurringEditDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Edit Recurring Appointment
          </AlertDialogTitle>
          <AlertDialogDescription>
            This appointment is part of a recurring series. How would you like to apply your changes?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            className="justify-start h-auto py-3 px-4"
            onClick={() => onSelect('this_only')}
            disabled={isLoading}
          >
            <div className="text-left">
              <div className="font-medium">Only this appointment</div>
              <div className="text-sm text-muted-foreground">
                Changes will only affect this single occurrence
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3 px-4"
            onClick={() => onSelect('this_and_future')}
            disabled={isLoading}
          >
            <div className="text-left">
              <div className="font-medium">This and all future appointments</div>
              <div className="text-sm text-muted-foreground">
                Changes will apply to this and all future occurrences in the series
              </div>
            </div>
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
