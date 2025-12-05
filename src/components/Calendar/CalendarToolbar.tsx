import { ToolbarProps, View } from 'react-big-calendar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface CalendarToolbarProps extends ToolbarProps {
  workingHoursStart?: number;
  workingHoursEnd?: number;
  onWorkingHoursChange?: (start: number, end: number) => void;
}

// Full 24-hour options (0-23)
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

export function CalendarToolbar({ 
  onNavigate, 
  onView, 
  label, 
  view,
  workingHoursStart = 7,
  workingHoursEnd = 21,
  onWorkingHoursChange,
}: CalendarToolbarProps) {
  
  // Filter start options: can't start at hour 22 or 23 (no room for valid end)
  const startOptions = ALL_HOURS.filter(opt => opt.value <= 23 - MIN_HOUR_GAP);
  
  // Filter end options: must be at least MIN_HOUR_GAP hours after current start
  const endOptions = ALL_HOURS.filter(opt => opt.value >= workingHoursStart + MIN_HOUR_GAP);

  const handleStartChange = (value: string) => {
    const newStart = parseInt(value, 10);
    const minEnd = newStart + MIN_HOUR_GAP;
    const adjustedEnd = workingHoursEnd < minEnd ? minEnd : workingHoursEnd;
    onWorkingHoursChange?.(newStart, adjustedEnd);
  };

  const handleEndChange = (value: string) => {
    const newEnd = parseInt(value, 10);
    const maxStart = newEnd - MIN_HOUR_GAP;
    const adjustedStart = workingHoursStart > maxStart ? maxStart : workingHoursStart;
    onWorkingHoursChange?.(adjustedStart, newEnd);
  };

  return (
    <div className="flex items-center justify-between mb-4 gap-4">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('PREV')}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => onNavigate('TODAY')}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('NEXT')}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Title */}
      <h2 className="text-lg font-semibold flex-1 text-center">{label}</h2>

      {/* View Switcher + Settings */}
      <div className="flex items-center gap-2">
        <Button
          variant={view === 'month' ? 'default' : 'outline'}
          onClick={() => onView('month' as View)}
        >
          Month
        </Button>
        <Button
          variant={view === 'week' ? 'default' : 'outline'}
          onClick={() => onView('week' as View)}
        >
          Week
        </Button>
        <Button
          variant={view === 'day' ? 'default' : 'outline'}
          onClick={() => onView('day' as View)}
        >
          Day
        </Button>

        {/* Working Hours Settings */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Calendar settings">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Working Hours</h4>
              
              <div className="space-y-2">
                <Label htmlFor="start-time" className="text-sm text-muted-foreground">
                  Day starts at
                </Label>
                <Select
                  value={workingHoursStart.toString()}
                  onValueChange={handleStartChange}
                >
                  <SelectTrigger id="start-time">
                    <SelectValue>
                      {ALL_HOURS.find(h => h.value === workingHoursStart)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {startOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-time" className="text-sm text-muted-foreground">
                  Day ends at
                </Label>
                <Select
                  value={workingHoursEnd.toString()}
                  onValueChange={handleEndChange}
                >
                  <SelectTrigger id="end-time">
                    <SelectValue>
                      {ALL_HOURS.find(h => h.value === workingHoursEnd)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {endOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
