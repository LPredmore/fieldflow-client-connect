import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import AvailabilitySettings from '@/components/Settings/AvailabilitySettings';
import CalendarSettings from '@/components/Settings/CalendarSettings';
import { useSchedulingPreferences } from '@/hooks/useSchedulingPreferences';

const ALL_HOURS = [
  { value: 0, label: '12:00 AM' },
  { value: 1, label: '1:00 AM' },
  { value: 2, label: '2:00 AM' },
  { value: 3, label: '3:00 AM' },
  { value: 4, label: '4:00 AM' },
  { value: 5, label: '5:00 AM' },
  { value: 6, label: '6:00 AM' },
  { value: 7, label: '7:00 AM' },
  { value: 8, label: '8:00 AM' },
  { value: 9, label: '9:00 AM' },
  { value: 10, label: '10:00 AM' },
  { value: 11, label: '11:00 AM' },
  { value: 12, label: '12:00 PM' },
  { value: 13, label: '1:00 PM' },
  { value: 14, label: '2:00 PM' },
  { value: 15, label: '3:00 PM' },
  { value: 16, label: '4:00 PM' },
  { value: 17, label: '5:00 PM' },
  { value: 18, label: '6:00 PM' },
  { value: 19, label: '7:00 PM' },
  { value: 20, label: '8:00 PM' },
  { value: 21, label: '9:00 PM' },
  { value: 22, label: '10:00 PM' },
  { value: 23, label: '11:00 PM' },
];

const MIN_HOUR_GAP = 2;

interface CalendarSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workingHoursStart: number;
  workingHoursEnd: number;
  onWorkingHoursChange: (start: number, end: number) => void;
  onSettingsChanged?: () => void;
}

export function CalendarSettingsPanel({
  open,
  onOpenChange,
  workingHoursStart,
  workingHoursEnd,
  onWorkingHoursChange,
  onSettingsChanged,
}: CalendarSettingsPanelProps) {
  const [workingOpen, setWorkingOpen] = useState(true);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [schedulingOpen, setSchedulingOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { preferences, loading: prefsLoading, saving, updatePreference } = useSchedulingPreferences({
    onSaved: onSettingsChanged,
  });

  const startOptions = ALL_HOURS.filter(opt => opt.value <= 23 - MIN_HOUR_GAP);
  const endOptions = ALL_HOURS.filter(opt => opt.value >= workingHoursStart + MIN_HOUR_GAP);

  const handleStartChange = (value: string) => {
    const newStart = parseInt(value, 10);
    const minEnd = newStart + MIN_HOUR_GAP;
    const adjustedEnd = workingHoursEnd < minEnd ? minEnd : workingHoursEnd;
    onWorkingHoursChange(newStart, adjustedEnd);
  };

  const handleEndChange = (value: string) => {
    const newEnd = parseInt(value, 10);
    const maxStart = newEnd - MIN_HOUR_GAP;
    const adjustedStart = workingHoursStart > maxStart ? maxStart : workingHoursStart;
    onWorkingHoursChange(adjustedStart, newEnd);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Calendar Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-2 mt-6">
          {/* Working Hours */}
          <Collapsible open={workingOpen} onOpenChange={setWorkingOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-border px-4 py-3 font-medium text-sm hover:bg-accent transition-colors">
              Working Hours
              <ChevronDown className={cn('h-4 w-4 transition-transform', workingOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pt-4 pb-2 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Day starts at</Label>
                <Select value={workingHoursStart.toString()} onValueChange={handleStartChange}>
                  <SelectTrigger>
                    <SelectValue>{ALL_HOURS.find(h => h.value === workingHoursStart)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {startOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Day ends at</Label>
                <Select value={workingHoursEnd.toString()} onValueChange={handleEndChange}>
                  <SelectTrigger>
                    <SelectValue>{ALL_HOURS.find(h => h.value === workingHoursEnd)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {endOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Availability */}
          <Collapsible open={availabilityOpen} onOpenChange={setAvailabilityOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-border px-4 py-3 font-medium text-sm hover:bg-accent transition-colors">
              Availability
              <ChevronDown className={cn('h-4 w-4 transition-transform', availabilityOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 pb-2">
              <AvailabilitySettings embedded onSaved={onSettingsChanged} />
            </CollapsibleContent>
          </Collapsible>

          {/* Scheduling Preferences */}
          <Collapsible open={schedulingOpen} onOpenChange={setSchedulingOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-border px-4 py-3 font-medium text-sm hover:bg-accent transition-colors">
              Scheduling Preferences
              <ChevronDown className={cn('h-4 w-4 transition-transform', schedulingOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pt-4 pb-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Allow Client Self-Scheduling</Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, clients can book appointments during your available time slots.
                  </p>
                </div>
                <Switch
                  checked={preferences.prov_self_scheduling_enabled}
                  onCheckedChange={(checked) => updatePreference('prov_self_scheduling_enabled', checked)}
                  disabled={prefsLoading || saving}
                />
              </div>

              {preferences.prov_self_scheduling_enabled && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Booking Interval</Label>
                  <Select
                    value={preferences.prov_scheduling_interval_minutes.toString()}
                    onValueChange={(val) => updatePreference('prov_scheduling_interval_minutes', parseInt(val, 10))}
                    disabled={prefsLoading || saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">On the hour (e.g., 9:00, 10:00)</SelectItem>
                      <SelectItem value="30">On the half-hour (e.g., 9:00, 9:30, 10:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={calendarOpen} onOpenChange={setCalendarOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-border px-4 py-3 font-medium text-sm hover:bg-accent transition-colors">
              Calendar Integration
              <ChevronDown className={cn('h-4 w-4 transition-transform', calendarOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 pb-2">
              <CalendarSettings embedded onSaved={onSettingsChanged} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  );
}
