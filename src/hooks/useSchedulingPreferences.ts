import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SchedulingPreferences {
  prov_self_scheduling_enabled: boolean;
  prov_scheduling_interval_minutes: number;
}

interface UseSchedulingPreferencesOptions {
  onSaved?: () => void;
}

export function useSchedulingPreferences({ onSaved }: UseSchedulingPreferencesOptions = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<SchedulingPreferences>({
    prov_self_scheduling_enabled: false,
    prov_scheduling_interval_minutes: 60,
  });

  useEffect(() => {
    if (!user?.id) return;

    const fetchPreferences = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('staff')
        .select('id, prov_self_scheduling_enabled, prov_scheduling_interval_minutes')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching scheduling preferences:', error);
      } else if (data) {
        setStaffId(data.id);
        setPreferences({
          prov_self_scheduling_enabled: data.prov_self_scheduling_enabled ?? false,
          prov_scheduling_interval_minutes: data.prov_scheduling_interval_minutes ?? 60,
        });
      }
      setLoading(false);
    };

    fetchPreferences();
  }, [user?.id]);

  const updatePreference = useCallback(
    async (field: keyof SchedulingPreferences, value: boolean | number) => {
      if (!staffId) return;

      setSaving(true);
      const { error } = await supabase
        .from('staff')
        .update({ [field]: value } as any)
        .eq('id', staffId);

      if (error) {
        console.error('Error updating scheduling preference:', error);
        toast({
          title: 'Error',
          description: 'Failed to update scheduling preference.',
          variant: 'destructive',
        });
      } else {
        setPreferences(prev => ({ ...prev, [field]: value }));
        toast({
          title: 'Preference updated',
          description: 'Your scheduling preference has been saved.',
        });
        onSaved?.();
      }
      setSaving(false);
    },
    [staffId, toast, onSaved],
  );

  return { preferences, loading, saving, updatePreference };
}
