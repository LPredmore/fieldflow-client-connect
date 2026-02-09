import { CalendarWrapper } from '@/components/Calendar/CalendarWrapper';

export default function Calendar() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Calendar</h1>
      <CalendarWrapper showCreateButton />
    </div>
  );
}
