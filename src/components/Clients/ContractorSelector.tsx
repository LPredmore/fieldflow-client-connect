import { useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSupabaseQuery } from "@/hooks/data/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";

interface Staff {
  id: string;
  prov_name_f: string | null;
  prov_name_l: string | null;
  prov_status: string | null;
}

interface ContractorSelectorProps {
  value?: string;
  onValueChange: (staffId: string) => void;
  disabled?: boolean;
}

export function ContractorSelector({ value, onValueChange, disabled }: ContractorSelectorProps) {
  const [open, setOpen] = useState(false);
  const { tenantId } = useAuth();
  
  const { data: staff, loading } = useSupabaseQuery<Staff>({
    table: 'staff',
    select: 'id, prov_name_f, prov_name_l, prov_status',
    filters: {
      tenant_id: tenantId,
      prov_status: 'active',
    },
    enabled: !!tenantId,
  });

  const selectedStaff = staff?.find(s => s.id === value);
  const staffName = selectedStaff 
    ? `${selectedStaff.prov_name_f || ''} ${selectedStaff.prov_name_l || ''}`.trim() 
    : null;

  if (loading) {
    return (
      <Button
        variant="outline"
        role="combobox"
        disabled
        className="w-full justify-between"
      >
        Loading clinicians...
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          {staffName ? (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{staffName}</span>
            </div>
          ) : (
            "Select clinician..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search clinicians..." />
          <CommandEmpty>No clinicians found.</CommandEmpty>
          <CommandGroup>
            {(staff || []).map((s) => {
              const name = `${s.prov_name_f || ''} ${s.prov_name_l || ''}`.trim() || 'Unnamed';
              return (
                <CommandItem
                  key={s.id}
                  value={name}
                  onSelect={() => {
                    onValueChange(s.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === s.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{name}</span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
