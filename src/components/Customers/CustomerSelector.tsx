import { useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomers, Customer } from "@/hooks/useCustomers";
import { getCustomerDisplayName } from "@/utils/customerDisplayName";

interface CustomerSelectorProps {
  value?: string;
  onValueChange: (customerId: string, customerName: string) => void;
  disabled?: boolean;
}

export function CustomerSelector({ value, onValueChange, disabled }: CustomerSelectorProps) {
  const [open, setOpen] = useState(false);
  const { customers, loading } = useCustomers();

  const selectedCustomer = customers.find(customer => customer.id === value);

  const handleSelect = (customer: Customer) => {
    const displayName = getCustomerDisplayName(customer);
    onValueChange(customer.id, displayName);
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
          {selectedCustomer ? (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{getCustomerDisplayName(selectedCustomer)}</span>
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
          <CommandEmpty>No patients found.</CommandEmpty>
          <CommandGroup>
            {customers.map((customer) => (
              <CommandItem
                key={customer.id}
                value={getCustomerDisplayName(customer)}
                onSelect={() => handleSelect(customer)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === customer.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{getCustomerDisplayName(customer)}</span>
                    {customer.pat_phone && (
                      <span className="text-xs text-muted-foreground">{customer.pat_phone}</span>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}