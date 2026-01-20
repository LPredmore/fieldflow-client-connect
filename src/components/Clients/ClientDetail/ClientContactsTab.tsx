import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, AlertCircle, Phone, Mail, MapPin } from 'lucide-react';
import { EmergencyContact } from '@/hooks/useClientDetail';

interface ClientContactsTabProps {
  loading: boolean;
  emergencyContacts: EmergencyContact[];
}

export function ClientContactsTab({ loading, emergencyContacts }: ClientContactsTabProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (emergencyContacts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No Emergency Contacts</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No emergency contacts have been added for this client yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeContacts = emergencyContacts.filter(c => c.is_active);
  const inactiveContacts = emergencyContacts.filter(c => !c.is_active);

  const formatAddress = (contact: EmergencyContact) => {
    const parts = [
      contact.addr_1,
      contact.addr_2,
      contact.city,
      contact.state,
      contact.zip,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  return (
    <div className="space-y-6">
      {/* Active Contacts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Emergency Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeContacts.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>No active emergency contacts</span>
            </div>
          ) : (
            <div className="space-y-4">
              {activeContacts.map((contact) => (
                <div 
                  key={contact.id} 
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.name}</span>
                      {contact.relationship && (
                        <span className="text-muted-foreground">
                          ({contact.relationship})
                        </span>
                      )}
                    </div>
                    {contact.is_primary && (
                      <Badge>Primary</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.phone}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                    {formatAddress(contact) && (
                      <div className="flex items-start gap-2 col-span-full">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{formatAddress(contact)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive Contacts (if any) */}
      {inactiveContacts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              Inactive Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveContacts.map((contact) => (
                  <TableRow key={contact.id} className="text-muted-foreground">
                    <TableCell>{contact.name}</TableCell>
                    <TableCell>{contact.relationship || '-'}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
