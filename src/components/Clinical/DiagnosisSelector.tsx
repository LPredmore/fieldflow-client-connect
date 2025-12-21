import React, { useState } from 'react';
import { Check, ChevronsUpDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useDiagnosisCodes, DiagnosisCode } from '@/hooks/useDiagnosisCodes';

interface DiagnosisSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DiagnosisSelector({
  selectedIds,
  onChange,
  disabled = false,
  placeholder = "Select diagnoses...",
}: DiagnosisSelectorProps) {
  const [open, setOpen] = useState(false);
  const { codes, filteredCodes, loading, searchTerm, setSearchTerm } = useDiagnosisCodes();

  // Get selected codes for display
  const selectedCodes = codes.filter(code => selectedIds.includes(code.id));

  const handleSelect = (codeId: string) => {
    if (selectedIds.includes(codeId)) {
      onChange(selectedIds.filter(id => id !== codeId));
    } else {
      onChange([...selectedIds, codeId]);
    }
  };

  const handleRemove = (codeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter(id => id !== codeId));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10"
            disabled={disabled}
          >
            <span className="text-muted-foreground">
              {selectedIds.length === 0 
                ? placeholder 
                : `${selectedIds.length} diagnosis${selectedIds.length > 1 ? 'es' : ''} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search ICD-10 codes..." 
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading diagnoses...
                </div>
              ) : (
                <>
                  <CommandEmpty>No diagnosis found.</CommandEmpty>
                  <CommandGroup className="max-h-[300px] overflow-auto">
                    {filteredCodes.map((code) => (
                      <CommandItem
                        key={code.id}
                        value={code.id}
                        onSelect={() => handleSelect(code.id)}
                        className="flex items-start gap-2 py-2"
                      >
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            selectedIds.includes(code.id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{code.code}</span>
                          <span className="text-sm text-muted-foreground">
                            {code.description}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected diagnoses display */}
      {selectedCodes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCodes.map((code) => (
            <Badge
              key={code.id}
              variant="secondary"
              className="flex items-center gap-1 py-1 px-2"
            >
              <span className="font-medium">{code.code}</span>
              <span className="text-xs">- {code.description}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemove(code.id, e)}
                  className="ml-1 rounded-full hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
