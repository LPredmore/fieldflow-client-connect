import { EventProps } from 'react-big-calendar';

interface AppointmentEventData {
  id: string;
  title: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  customer_name: string;
}

export function AppointmentEvent({ event }: EventProps<AppointmentEventData>) {
  const { title, customer_name } = event;

  return (
    <div className="flex flex-col overflow-hidden px-1">
      <span className="font-medium text-xs truncate">{title}</span>
      <span className="text-xs opacity-90 truncate">{customer_name}</span>
    </div>
  );
}
