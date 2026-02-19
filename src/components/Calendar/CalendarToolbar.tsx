import { ToolbarProps, View } from 'react-big-calendar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';

interface CalendarToolbarProps extends ToolbarProps {
  onSettingsClick?: () => void;
}

export function CalendarToolbar({ 
  onNavigate, 
  onView, 
  label, 
  view,
  onSettingsClick,
}: CalendarToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-4 gap-4">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => onNavigate('PREV')} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => onNavigate('TODAY')}>Today</Button>
        <Button variant="outline" size="icon" onClick={() => onNavigate('NEXT')} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Title */}
      <h2 className="text-lg font-semibold flex-1 text-center">{label}</h2>

      {/* View Switcher + Settings */}
      <div className="flex items-center gap-2">
        <Button variant={view === 'month' ? 'default' : 'outline'} onClick={() => onView('month' as View)}>Month</Button>
        <Button variant={view === 'week' ? 'default' : 'outline'} onClick={() => onView('week' as View)}>Week</Button>
        <Button variant={view === 'day' ? 'default' : 'outline'} onClick={() => onView('day' as View)}>Day</Button>
        <Button variant="outline" size="icon" aria-label="Calendar settings" onClick={onSettingsClick}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}