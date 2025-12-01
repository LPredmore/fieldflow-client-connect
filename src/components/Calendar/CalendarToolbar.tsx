import { ToolbarProps, View } from 'react-big-calendar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function CalendarToolbar({ onNavigate, onView, label, view }: ToolbarProps) {
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

      {/* View Switcher */}
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
      </div>
    </div>
  );
}
