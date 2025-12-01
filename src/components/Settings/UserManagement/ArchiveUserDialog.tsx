import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Profile } from '@/hooks/useProfiles';
import { supabase } from '@/integrations/supabase/client';
import { useRoleCacheInvalidation } from '@/hooks/useRoleCacheInvalidation';
import { useToast } from '@/hooks/use-toast';

interface ArchiveUserDialogProps {
  profile: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ArchiveUserDialog({ 
  profile, 
  open, 
  onOpenChange, 
  onConfirm 
}: ArchiveUserDialogProps) {
  const { invalidateUserRole } = useRoleCacheInvalidation();
  const { toast } = useToast();
  const [emailConfirmation, setEmailConfirmation] = useState('');
  const [understood, setUnderstood] = useState(false);

  const isValid = emailConfirmation === profile.email && understood;

  const handleConfirm = async () => {
    if (!isValid) return;

    try {
      // Note: user_roles table doesn't have is_active column in current schema
      // Archiving would need to be implemented differently

      // Proceed with archive
      onConfirm();
      
      // Invalidate cache
      invalidateUserRole(profile.id);
      
      // Reset form
      setEmailConfirmation('');
      setUnderstood(false);
    } catch (error) {
      console.error('Error in archive process:', error);
      toast({
        title: "Error",
        description: "Failed to archive user. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive User</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              You are about to archive <strong>{profile.display_name || profile.email}</strong>. 
              This action will:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Remove their login access permanently</li>
              <li>Keep all their clinical data (appointments, notes, licenses)</li>
              <li>Remove them from the active team members list</li>
              <li>Allow you to restore them later if needed</li>
            </ul>
            
            <div className="space-y-3 pt-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="understand"
                  checked={understood}
                  onCheckedChange={(checked) => setUnderstood(checked as boolean)}
                />
                <label
                  htmlFor="understand"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I understand this will remove their login access but preserve all clinical data
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-confirm">
                  Type <strong>{profile.email}</strong> to confirm
                </Label>
                <Input
                  id="email-confirm"
                  value={emailConfirmation}
                  onChange={(e) => setEmailConfirmation(e.target.value)}
                  placeholder="Enter email to confirm"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isValid}
            className="bg-destructive hover:bg-destructive/90"
          >
            Archive User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
