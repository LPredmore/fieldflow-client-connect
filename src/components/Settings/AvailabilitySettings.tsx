import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Clock } from 'lucide-react';
import { useStaffAvailability, AvailabilitySlotInput } from '@/hooks/useStaffAvailability';
import { Badge } from '@/components/ui/badge';

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

// Generate time options in 30-min increments
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const value = `${hh}:${mm}:00`;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayH}:${mm} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

interface NewSlotState {
  start_time: string;
  end_time: string;
}

interface AvailabilitySettingsProps {
  embedded?: boolean;
  onSaved?: () => void;
}

export default function AvailabilitySettings({ embedded = false, onSaved }: AvailabilitySettingsProps) {
  const { slots, loading, staffTimezone, upsertSlot, updateSlot, deleteSlot } = useStaffAvailability();
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [newSlot, setNewSlot] = useState<NewSlotState>({ start_time: '09:00:00', end_time: '17:00:00' });

  const slotsForDay = (day: number) =>
    slots.filter((s) => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const handleAddSlot = async (day: number) => {
    const input: AvailabilitySlotInput = {
      day_of_week: day,
      start_time: newSlot.start_time,
      end_time: newSlot.end_time,
      is_active: true,
    };
    await upsertSlot(input);
    setAddingDay(null);
    setNewSlot({ start_time: '09:00:00', end_time: '17:00:00' });
    onSaved?.();
  };

  const formatTime = (time: string) => {
    const match = TIME_OPTIONS.find((t) => t.value === time);
    return match?.label || time;
  };

  if (loading) {
    if (embedded) {
      return (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Availability Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const daysList = (
    <div className="space-y-4">
      {DAYS.map((day) => {
        const daySlots = slotsForDay(day.value);
        const isAdding = addingDay === day.value;

        return (
          <div
            key={day.value}
            className="border border-border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{day.label}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAddingDay(isAdding ? null : day.value);
                  setNewSlot({ start_time: '09:00:00', end_time: '17:00:00' });
                }}
                className="text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Slot
              </Button>
            </div>

            {daySlots.length === 0 && !isAdding && (
              <p className="text-sm text-muted-foreground">No availability set</p>
            )}

            {daySlots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center gap-3 bg-secondary/50 rounded-md px-3 py-2"
              >
                <Switch
                  checked={slot.is_active}
                  onCheckedChange={async (checked) => { await updateSlot(slot.id, { is_active: checked }); onSaved?.(); }}
                />
                <span className="text-sm font-medium text-foreground flex-1">
                  {formatTime(slot.start_time)} — {formatTime(slot.end_time)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={async () => { await deleteSlot(slot.id); onSaved?.(); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            {isAdding && (
              <div className="flex items-center gap-2 bg-accent/30 rounded-md px-3 py-2">
                <Select
                  value={newSlot.start_time}
                  onValueChange={(v) => setNewSlot((s) => ({ ...s, start_time: v }))}
                >
                  <SelectTrigger className="w-[130px] h-8 text-sm">
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
                <span className="text-sm text-muted-foreground">to</span>
                <Select
                  value={newSlot.end_time}
                  onValueChange={(v) => setNewSlot((s) => ({ ...s, end_time: v }))}
                >
                  <SelectTrigger className="w-[130px] h-8 text-sm">
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
                <Button size="sm" className="h-8" onClick={() => handleAddSlot(day.value)}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setAddingDay(null)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Set your weekly recurring availability</p>
          <Badge variant="outline" className="text-xs">
            Times in {staffTimezone}
          </Badge>
        </div>
        {daysList}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Availability Schedule
            </CardTitle>
            <CardDescription className="mt-1.5">
              Set your weekly recurring availability for client scheduling
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            Times in {staffTimezone}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {daysList}
      </CardContent>
    </Card>
  );
}
