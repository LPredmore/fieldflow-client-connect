/**
 * IncompleteFieldWarningDialog Component
 * Warning dialog shown when user tries to save changes that would make profile incomplete
 * while "Accepting New Clients" is enabled
 */

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
import { AlertTriangle } from 'lucide-react';

interface IncompleteFieldWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingFields: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function IncompleteFieldWarningDialog({
  open,
  onOpenChange,
  missingFields,
  onConfirm,
  onCancel,
}: IncompleteFieldWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            This Will Disable Your Availability
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <p>
                Saving without the following will automatically turn off &ldquo;Accepting New Clients&rdquo; because your profile will be incomplete:
              </p>
              
              <ul className="ml-4 list-disc text-muted-foreground">
                {missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
              
              <p className="text-sm text-muted-foreground">
                You won&apos;t be able to turn it back on until you complete all required fields.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Save Anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
