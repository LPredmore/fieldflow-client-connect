/**
 * MissingFieldsAlert Component
 * Displays an AlertDialog when user tries to enable "Accepting New Clients" with incomplete profile
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle } from 'lucide-react';

interface MissingFieldsAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingFieldsBySection: Record<string, string[]>;
}

export function MissingFieldsAlert({
  open,
  onOpenChange,
  missingFieldsBySection,
}: MissingFieldsAlertProps) {
  const sections = Object.entries(missingFieldsBySection);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Complete Your Profile First
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <p>
                Before you can accept new clients, please complete the following required fields:
              </p>
              
              <div className="space-y-3">
                {sections.map(([section, fields]) => (
                  <div key={section}>
                    <p className="font-medium text-foreground">{section}:</p>
                    <ul className="mt-1 ml-4 list-disc text-muted-foreground">
                      {fields.map((field) => (
                        <li key={field}>{field}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>Got It</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
