import { format, differenceInYears } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, MapPin, Calendar, Clock, Target } from 'lucide-react';
import { Client } from '@/types/client';

interface ClientOverviewTabProps {
  client: Client;
}

export function ClientOverviewTab({ client }: ClientOverviewTabProps) {
  const formatAddress = () => {
    const parts = [
      client.pat_addr_1,
      client.pat_addr_2,
      client.pat_city,
      client.pat_state,
      client.pat_zip,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const calculateAge = () => {
    if (!client.pat_dob) return null;
    try {
      return differenceInYears(new Date(), new Date(client.pat_dob));
    } catch {
      return null;
    }
  };

  const age = calculateAge();

  const getSexLabel = (sex: string | null) => {
    if (!sex) return null;
    switch (sex) {
      case 'M': return 'Male';
      case 'F': return 'Female';
      default: return sex;
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      case 'discharged': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Status and Key Info */}
      <div className="flex flex-wrap gap-2">
        {client.pat_status && (
          <Badge className={getStatusColor(client.pat_status)}>
            {client.pat_status}
          </Badge>
        )}
        {client.pcn && (
          <Badge variant="outline">PCN: {client.pcn}</Badge>
        )}
      </div>

      {/* Demographics Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Demographics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {client.pat_dob && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">
                  {format(new Date(client.pat_dob), 'MMM d, yyyy')}
                  {age !== null && <span className="text-muted-foreground ml-1">({age} years)</span>}
                </p>
              </div>
            )}
            {client.pat_sex && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Biological Sex</p>
                <p className="font-medium">{getSexLabel(client.pat_sex)}</p>
              </div>
            )}
            {client.pat_gender_identity && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Gender Identity</p>
                <p className="font-medium">{client.pat_gender_identity}</p>
              </div>
            )}
            {client.pat_marital_status && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Marital Status</p>
                <p className="font-medium">{client.pat_marital_status}</p>
              </div>
            )}
            {client.pat_name_preferred && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Preferred Name</p>
                <p className="font-medium">{client.pat_name_preferred}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {client.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium break-all">{client.email}</p>
                </div>
              </div>
            )}
            {client.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{client.phone}</p>
                </div>
              </div>
            )}
            {client.pat_time_zone && (
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Timezone</p>
                  <p className="font-medium">{client.pat_time_zone}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Address Card */}
      {formatAddress() && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {client.pat_addr_1 && <p className="font-medium">{client.pat_addr_1}</p>}
              {client.pat_addr_2 && <p className="font-medium">{client.pat_addr_2}</p>}
              <p className="font-medium">
                {[client.pat_city, client.pat_state, client.pat_zip].filter(Boolean).join(', ')}
              </p>
              {client.pat_country && client.pat_country !== 'US' && (
                <p className="font-medium">{client.pat_country}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal Card */}
      {client.pat_goal && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Client Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{client.pat_goal}</p>
          </CardContent>
        </Card>
      )}

      {/* Assignment & Dates Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Assignment & Dates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Assigned Clinician</p>
              <p className="font-medium">{client.assigned_staff_name || 'Unassigned'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{format(new Date(client.created_at), 'MMM d, yyyy')}</p>
            </div>
            {client.updated_at && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium">{format(new Date(client.updated_at), 'MMM d, yyyy')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
