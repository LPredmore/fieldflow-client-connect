import { useServicesData } from '@/hooks/data/useServicesData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface ServiceSelectorProps {
  value?: string;
  onValueChange: (serviceId: string, serviceName: string) => void;
  placeholder?: string;
}

export function ServiceSelector({ value, onValueChange, placeholder = "Select service" }: ServiceSelectorProps) {
  const { data: services, loading } = useServicesData();

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading services...</span>
      </div>
    );
  }

  return (
    <Select
      value={value || ''}
      onValueChange={(selectedId) => {
        const service = services?.find(s => s.id === selectedId);
        if (service) {
          onValueChange(selectedId, service.name);
        }
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {services && services.length > 0 ? (
          services.map((service) => (
            <SelectItem key={service.id} value={service.id}>
              {service.name} {service.category && `(${service.category})`}
            </SelectItem>
          ))
        ) : (
          <SelectItem value="none" disabled>
            No services available
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
