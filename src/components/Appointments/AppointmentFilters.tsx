import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DB_ENUMS } from "@/schema/enums";

export interface AppointmentFilterValues {
  status: string | null;
  clientId: string | null;
  serviceId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
}

interface Client {
  id: string;
  pat_name_preferred: string | null;
  pat_name_f: string;
  pat_name_l: string;
}

interface Service {
  id: string;
  name: string;
}

interface AppointmentFiltersProps {
  filters: AppointmentFilterValues;
  onFiltersChange: (filters: AppointmentFilterValues) => void;
  clients: Client[];
  services: Service[];
  onClose: () => void;
}

const STATUS_OPTIONS = DB_ENUMS.appointment_status_enum;

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  documented: "Documented",
  cancelled: "Cancelled",
  "late_cancel/noshow": "Late Cancel / No Show",
};

export function AppointmentFilters({
  filters,
  onFiltersChange,
  clients,
  services,
  onClose,
}: AppointmentFiltersProps) {
  const [localFilters, setLocalFilters] = useState<AppointmentFilterValues>(filters);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters: AppointmentFilterValues = {
      status: null,
      clientId: null,
      serviceId: null,
      dateFrom: null,
      dateTo: null,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    onClose();
  };

  const getClientDisplayName = (client: Client) => {
    const preferred = client.pat_name_preferred?.trim();
    const lastName = client.pat_name_l?.trim();
    
    if (preferred && lastName) {
      return `${preferred} ${lastName}`;
    }
    if (preferred) {
      return preferred;
    }
    return `${client.pat_name_f} ${lastName}`.trim() || "Unknown";
  };

  const hasActiveFilters = 
    localFilters.status || 
    localFilters.clientId || 
    localFilters.serviceId || 
    localFilters.dateFrom || 
    localFilters.dateTo;

  return (
    <div className="space-y-4 p-4">
      {/* Status Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Status</label>
        <Select
          value={localFilters.status || "all"}
          onValueChange={(value) =>
            setLocalFilters((prev) => ({
              ...prev,
              status: value === "all" ? null : value,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status] || status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Client Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Client</label>
        <Select
          value={localFilters.clientId || "all"}
          onValueChange={(value) =>
            setLocalFilters((prev) => ({
              ...prev,
              clientId: value === "all" ? null : value,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {getClientDisplayName(client)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Service Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Service</label>
        <Select
          value={localFilters.serviceId || "all"}
          onValueChange={(value) =>
            setLocalFilters((prev) => ({
              ...prev,
              serviceId: value === "all" ? null : value,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Date Range</label>
        <div className="flex gap-2">
          {/* From Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 justify-start text-left font-normal",
                  !localFilters.dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {localFilters.dateFrom
                  ? format(localFilters.dateFrom, "MMM d, yyyy")
                  : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={localFilters.dateFrom || undefined}
                onSelect={(date) =>
                  setLocalFilters((prev) => ({ ...prev, dateFrom: date || null }))
                }
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* To Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 justify-start text-left font-normal",
                  !localFilters.dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {localFilters.dateTo
                  ? format(localFilters.dateTo, "MMM d, yyyy")
                  : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={localFilters.dateTo || undefined}
                onSelect={(date) =>
                  setLocalFilters((prev) => ({ ...prev, dateTo: date || null }))
                }
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={handleClear} disabled={!hasActiveFilters}>
          <X className="h-4 w-4 mr-2" />
          Clear
        </Button>
        <Button className="flex-1" onClick={handleApply}>
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
