import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Award } from "lucide-react";
import { useAvailableClinicians } from "@/hooks/useAvailableClinicians";
import { useState } from "react";

export function TherapistTab() {
  const { clinicians, loading, hasClientState, clientState } = useAvailableClinicians();
  const [expandedBios, setExpandedBios] = useState<Set<string>>(new Set());

  const toggleBio = (clinicianId: string) => {
    setExpandedBios((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clinicianId)) {
        newSet.delete(clinicianId);
      } else {
        newSet.add(clinicianId);
      }
      return newSet;
    });
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'C';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Available Therapists</h2>
          <p className="text-muted-foreground">
            Licensed therapists available in your state
          </p>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <p>Loading available therapists...</p>
        </div>
      </div>
    );
  }

  if (!hasClientState) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Available Therapists</h2>
          <p className="text-muted-foreground">
            Licensed therapists available in your state
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Complete Your Profile</p>
              <p className="text-sm mt-2">
                Please add your state in the Profile tab to see available therapists
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (clinicians.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Available Therapists</h2>
          <p className="text-muted-foreground">
            Licensed therapists available in {clientState}
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No Therapists Available</p>
              <p className="text-sm mt-2">
                There are currently no therapists accepting new clients in {clientState}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Available Therapists</h2>
        <p className="text-muted-foreground">
          {clinicians.length} licensed {clinicians.length === 1 ? 'therapist' : 'therapists'} available in {clientState}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {clinicians.map((clinician) => {
          const isBioExpanded = expandedBios.has(clinician.id);
          const bio = clinician.clinician_bio || '';
          const shouldTruncate = bio.length > 200;
          const displayBio = shouldTruncate && !isBioExpanded 
            ? bio.slice(0, 200) + '...' 
            : bio;

          return (
            <Card key={clinician.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage 
                      src={clinician.clinician_image_url || undefined} 
                  alt={clinician.prov_name_f && clinician.prov_name_last 
                       ? `${clinician.prov_name_f} ${clinician.prov_name_last}` 
                       : 'Clinician'}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(
                        clinician.profiles?.first_name,
                        clinician.profiles?.last_name
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-xl">
                      {clinician.prov_name_f && clinician.prov_name_last
                       ? `${clinician.prov_name_f} ${clinician.prov_name_last}`
                       : `${clinician.profiles?.first_name || ''} ${clinician.profiles?.last_name || ''}`.trim() ||
                       'Clinician'}
                    </CardTitle>
                    {clinician.clinician_license_type && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        <Award className="h-4 w-4" />
                        <span>{clinician.clinician_license_type}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {clinician.clinician_bio && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">About</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {displayBio}
                    </p>
                    {shouldTruncate && (
                      <button
                        onClick={() => toggleBio(clinician.id)}
                        className="text-sm text-primary hover:underline"
                      >
                        {isBioExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                )}
                
                {clinician.licenses && clinician.licenses.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Licensed In</h4>
                    <div className="flex flex-wrap gap-2">
                      {clinician.licenses.map((license, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {license.state} - {license.license_type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {clinician.clinician_treatment_approaches && 
                 clinician.clinician_treatment_approaches.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Treatment Approaches</h4>
                    <div className="flex flex-wrap gap-2">
                      {clinician.clinician_treatment_approaches.map((approach, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {approach}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
