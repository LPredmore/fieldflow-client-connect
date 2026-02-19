import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AvailabilitySlot {
  id: string;
  tenant_id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string; // HH:MM:SS
  end_time: string;
  is_active: boolean;
}

export interface AvailabilitySlotInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export function useStaffAvailability() {
  const { user, tenantId } = useAuth();
  const staffId = user?.roleContext?.staffData?.id;
  const staffTimezone = user?.roleContext?.staffData?.prov_time_zone || 'America/New_York';

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSlots = useCallback(async () => {
    if (!staffId) {
      setSlots([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_availability_schedules')
        .select('*')
        .eq('staff_id', staffId)
        .order('day_of_week')
        .order('start_time');

      if (error) {
        console.error('[useStaffAvailability] Fetch error:', error);
        toast.error('Failed to load availability schedule');
        return;
      }

      setSlots(data || []);
    } catch (err) {
      console.error('[useStaffAvailability] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const upsertSlot = useCallback(async (input: AvailabilitySlotInput) => {
    if (!staffId || !tenantId) return;

    const { error } = await supabase
      .from('staff_availability_schedules')
      .insert({
        tenant_id: tenantId,
        staff_id: staffId,
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time,
        is_active: input.is_active,
      });

    if (error) {
      console.error('[useStaffAvailability] Insert error:', error);
      toast.error('Failed to save availability slot');
      return;
    }

    toast.success('Availability saved');
    await fetchSlots();
  }, [staffId, tenantId, fetchSlots]);

  const updateSlot = useCallback(async (slotId: string, updates: Partial<AvailabilitySlotInput>) => {
    const { error } = await supabase
      .from('staff_availability_schedules')
      .update(updates)
      .eq('id', slotId);

    if (error) {
      console.error('[useStaffAvailability] Update error:', error);
      toast.error('Failed to update availability');
      return;
    }

    toast.success('Availability updated');
    await fetchSlots();
  }, [fetchSlots]);

  const deleteSlot = useCallback(async (slotId: string) => {
    const { error } = await supabase
      .from('staff_availability_schedules')
      .delete()
      .eq('id', slotId);

    if (error) {
      console.error('[useStaffAvailability] Delete error:', error);
      toast.error('Failed to remove availability slot');
      return;
    }

    toast.success('Availability slot removed');
    await fetchSlots();
  }, [fetchSlots]);

  return {
    slots,
    loading,
    staffTimezone,
    upsertSlot,
    updateSlot,
    deleteSlot,
    refetch: fetchSlots,
  };
}
