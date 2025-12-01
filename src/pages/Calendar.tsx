import { CalendarWrapper } from '@/components/Calendar/CalendarWrapper';
import { CreateAppointmentDialog } from '@/components/Appointments/CreateAppointmentDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function Calendar() {
  return (
    <div className="space-y-6">
      {/* Quick Actions Bar */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <CreateAppointmentDialog 
          trigger={
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Appointment
            </Button>
          }
        />
      </div>
      
      <CalendarWrapper />
    </div>
  );
}