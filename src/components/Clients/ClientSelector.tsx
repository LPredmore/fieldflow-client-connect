import { useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients, Client } from "@/hooks/useClients";
import { getClientDisplayName } from "@/utils/clientDisplayName";

interface ClientSelectorProps {
  value?: string;
  onValueChange: (clientId: string, clientName: string) => void;
  disabled?: boolean;
}

export function ClientSelector({ value, onValueChange, disabled }: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const { clients, loading } = useClients();

  const selectedClient = clients?.find(client => client.id === value);

  const handleSelect = (client: Client) => {
    const displayName = getClientDisplayName(client);
    onValueChange(client.id, displayName);
    setOpen(false);
  };

  if (loading) {
    return (
      <Button
        variant="outline"
        role="combobox"
        disabled
        className="w-full justify-between"
      >
        Loading patients...
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
          {selectedClient ? (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{getClientDisplayName(selectedClient)}</span>
            </div>
          ) : (
            "Select patient..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search patients..." />
          <CommandList>
            <CommandEmpty>No patients found.</CommandEmpty>
            <CommandGroup>
              {(clients || []).map((client) => (
                <CommandItem
                  key={client.id}
                  value={getClientDisplayName(client)}
                  onSelect={() => handleSelect(client)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === client.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{getClientDisplayName(client)}</span>
                      {client.phone && (
                        <span className="text-xs text-muted-foreground">{client.phone}</span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
