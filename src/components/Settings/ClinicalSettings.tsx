import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { useLicenseTypes } from "@/hooks/useLicenseTypes";
import { useToast } from "@/hooks/use-toast";

export default function ClinicalSettings() {
  const [specialty, setSpecialty] = useState("");
  const [license, setLicense] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const {
    licenseTypes,
    uniqueSpecialties,
    loading,
    addLicenseType,
    deleteLicenseType,
  } = useLicenseTypes();

  if (loading && licenseTypes === null) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const handleAddLicenseType = async () => {
    if (!specialty || !license) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please enter both specialty and license type.",
      });
      return;
    }

    const result = await addLicenseType(specialty, license);
    
    if (!result?.error) {
      setSpecialty("");
      setLicense("");
    }
  };

  const handleDelete = async (id: number) => {
    await deleteLicenseType(id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinical Settings</CardTitle>
        <CardDescription>
          Manage practice fields and accepted license types for your clinic
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add License Type Section */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <h3 className="font-semibold text-lg">Add License Type</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty / Practice Field</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="specialty"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {specialty || "Select or type specialty"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Search or type new specialty..." 
                      value={specialty}
                      onValueChange={setSpecialty}
                    />
                    <CommandList>
                      <CommandEmpty>Type to add new specialty</CommandEmpty>
                      <CommandGroup>
                        {uniqueSpecialties.map((spec) => (
                          <CommandItem
                            key={spec}
                            value={spec}
                            onSelect={(currentValue) => {
                              setSpecialty(currentValue);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                specialty === spec ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {spec}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="license">License Type</Label>
              <Input
                id="license"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                placeholder="e.g., LCSW, LPC, SLP"
              />
            </div>
          </div>

          <Button 
            onClick={handleAddLicenseType} 
            disabled={loading}
            className="w-full md:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add License Type
          </Button>
        </div>

        {/* License Types Table */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Current License Types</h3>
          
          {(licenseTypes?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No license types added yet. Add your first one above.
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Specialty</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(licenseTypes ?? []).map((licenseType) => (
                    <TableRow key={licenseType.id}>
                      <TableCell className="font-medium">
                        {licenseType.specialty || "N/A"}
                      </TableCell>
                      <TableCell>{licenseType.license || "N/A"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(licenseType.id)}
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
