import { useCallback } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AppointmentPrivateNote {
  id: string;
  tenant_id: string;
  appointment_id: string;
  created_by_profile_id: string;
  note_content: string | null;
  created_at: string;
  updated_at: string;
}

export function useAppointmentPrivateNote(appointmentId: string | undefined) {
  const { user, tenantId } = useAuth();
  const profileId = user?.id;

  const {
    data: notes,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<AppointmentPrivateNote>({
    table: 'appointment_private_notes',
    select: '*',
    filters: {
      appointment_id: appointmentId,
      created_by_profile_id: profileId,
    },
    enabled: !!appointmentId && !!profileId,
  });

  // Get the current user's private note (if any)
  const privateNote = notes?.[0] || null;

  // Save or update private note
  const savePrivateNote = useCallback(async (noteContent: string) => {
    if (!appointmentId || !tenantId || !profileId) {
      return { data: null, error: new Error("Missing required data") };
    }

    try {
      if (privateNote) {
        // Update existing note
        const { data, error } = await supabase
          .from('appointment_private_notes')
          .update({ note_content: noteContent || null })
          .eq('id', privateNote.id)
          .select()
          .single();

        if (error) throw error;
        await refetch();
        return { data, error: null };
      } else {
        // Create new note
        const { data, error } = await supabase
          .from('appointment_private_notes')
          .insert({
            tenant_id: tenantId,
            appointment_id: appointmentId,
            created_by_profile_id: profileId,
            note_content: noteContent || null,
          })
          .select()
          .single();

        if (error) throw error;
        await refetch();
        return { data, error: null };
      }
    } catch (err) {
      console.error('Error saving private note:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save private note",
        variant: "destructive",
      });
      return { data: null, error: err };
    }
  }, [appointmentId, tenantId, profileId, privateNote, refetch]);

  // Delete private note
  const deletePrivateNote = useCallback(async () => {
    if (!privateNote) {
      return { error: null };
    }

    try {
      const { error } = await supabase
        .from('appointment_private_notes')
        .delete()
        .eq('id', privateNote.id);

      if (error) throw error;
      await refetch();
      return { error: null };
    } catch (err) {
      console.error('Error deleting private note:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete private note",
        variant: "destructive",
      });
      return { error: err };
    }
  }, [privateNote, refetch]);

  return {
    privateNote,
    noteContent: privateNote?.note_content || '',
    loading,
    error,
    savePrivateNote,
    deletePrivateNote,
    refetch,
  };
}
