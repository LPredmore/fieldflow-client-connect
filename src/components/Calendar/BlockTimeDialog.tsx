import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Generate time options in 30-min increments
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const value = `${hh}:${mm}`;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayH}:${mm} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

interface BlockTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledDate?: string; // yyyy-MM-dd
  onBlockCreated: () => void;
}

export function BlockTimeDialog({ open, onOpenChange, prefilledDate, onBlockCreated }: BlockTimeDialogProps) {
  const { user, tenantId } = useAuth();
  const staffId = user?.roleContext?.staffData?.id;
  const staffTimezone = user?.roleContext?.staffData?.prov_time_zone || 'America/New_York';

  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(prefilledDate || today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!staffId || !tenantId) return;

    setSaving(true);
    try {
      // Convert local times to UTC via server RPC
      const [startResult, endResult] = await Promise.all([
        supabase.rpc('convert_local_to_utc', {
          p_date: date,
          p_time: startTime,
          p_timezone: staffTimezone,
        }),
        supabase.rpc('convert_local_to_utc', {
          p_date: date,
          p_time: endTime,
          p_timezone: staffTimezone,
        }),
      ]);

      if (startResult.error || endResult.error) {
        console.error('[BlockTimeDialog] RPC error:', startResult.error || endResult.error);
        toast.error('Failed to convert times');
        return;
      }

      const { error } = await supabase
        .from('staff_calendar_blocks')
        .insert({
          staff_id: staffId,
          tenant_id: tenantId,
          start_at: startResult.data,
          end_at: endResult.data,
          source: 'manual',
          summary: summary.trim() || 'Blocked',
        });

      if (error) {
        console.error('[BlockTimeDialog] Insert error:', error);
        toast.error('Failed to create block');
        return;
      }

      toast.success('Time block created');
      onOpenChange(false);
      onBlockCreated();

      // Reset form
      setSummary('');
      setStartTime('09:00');
      setEndTime('10:00');
    } catch (err) {
      console.error('[BlockTimeDialog] Error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Block Time</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="block-date">Date</Label>
            <Input
              id="block-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-summary">Label (optional)</Label>
            <Input
              id="block-summary"
              placeholder="e.g., Lunch, Personal, Meeting"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Times are in {staffTimezone}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Block Time'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
