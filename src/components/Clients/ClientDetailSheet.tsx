import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, User, Stethoscope, ClipboardCheck, FileText, CreditCard, Users } from 'lucide-react';
import { useClientDetail, ClientDetailTab, FormResponseWithTemplate } from '@/hooks/useClientDetail';
import { Client } from '@/types/client';
import { getClientDisplayName } from '@/utils/clientDisplayName';
import {
  ClientOverviewTab,
  ClientClinicalTab,
  ClientAssessmentsTab,
  ClientFormsTab,
  ClientInsuranceTab,
  ClientContactsTab,
} from './ClientDetail';

interface ClientDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  onEdit: (client: Client) => void;
  onTreatmentPlan: (client: Client) => void;
}

export function ClientDetailSheet({
  open,
  onOpenChange,
  clientId,
  onEdit,
  onTreatmentPlan,
}: ClientDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<ClientDetailTab>('overview');
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const [viewingFormResponse, setViewingFormResponse] = useState<FormResponseWithTemplate | null>(null);

  const {
    client,
    clientLoading,
    currentTreatmentPlan,
    activeDiagnoses,
    sessionNotes,
    phq9Assessments,
    gad7Assessments,
    pcl5Assessments,
    formResponses,
    insurance,
    emergencyContacts,
    tabLoading,
  } = useClientDetail({ clientId, activeTab });

  const handleTabChange = (value: string) => {
    setActiveTab(value as ClientDetailTab);
  };

  const handleViewTreatmentPlan = () => {
    if (client) {
      onOpenChange(false);
      onTreatmentPlan(client);
    }
  };

  const handleViewSessionNote = (noteId: string) => {
    setViewingNoteId(noteId);
    // TODO: Open SessionNoteViewDialog when implemented
  };

  const handleViewFormResponse = (response: FormResponseWithTemplate) => {
    setViewingFormResponse(response);
    // TODO: Open ResponseDetailDialog integration
  };

  const handleEdit = () => {
    if (client) {
      onOpenChange(false);
      onEdit(client);
    }
  };

  if (!clientId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
        <SheetHeader className="mb-6">
          {clientLoading ? (
            <>
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : client ? (
            <>
              <div className="flex items-center justify-between">
                <SheetTitle className="text-xl flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {getClientDisplayName(client)}
                </SheetTitle>
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
              <SheetDescription>
                {client.email && <span>{client.email}</span>}
                {client.email && client.phone && <span> • </span>}
                {client.phone && <span>{client.phone}</span>}
              </SheetDescription>
            </>
          ) : (
            <SheetTitle>Client Not Found</SheetTitle>
          )}
        </SheetHeader>

        {client && (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="w-full grid grid-cols-6 mb-6">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                <User className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="clinical" className="text-xs sm:text-sm">
                <Stethoscope className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Clinical</span>
              </TabsTrigger>
              <TabsTrigger value="assessments" className="text-xs sm:text-sm">
                <ClipboardCheck className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Assess</span>
              </TabsTrigger>
              <TabsTrigger value="forms" className="text-xs sm:text-sm">
                <FileText className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Forms</span>
              </TabsTrigger>
              <TabsTrigger value="insurance" className="text-xs sm:text-sm">
                <CreditCard className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Insurance</span>
              </TabsTrigger>
              <TabsTrigger value="contacts" className="text-xs sm:text-sm">
                <Users className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Contacts</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <ClientOverviewTab client={client} />
            </TabsContent>

            <TabsContent value="clinical">
              <ClientClinicalTab
                loading={tabLoading.clinical}
                currentTreatmentPlan={currentTreatmentPlan}
                activeDiagnoses={activeDiagnoses}
                sessionNotes={sessionNotes}
                onViewTreatmentPlan={handleViewTreatmentPlan}
                onViewSessionNote={handleViewSessionNote}
              />
            </TabsContent>

            <TabsContent value="assessments">
              <ClientAssessmentsTab
                loading={tabLoading.assessments}
                phq9Assessments={phq9Assessments}
                gad7Assessments={gad7Assessments}
                pcl5Assessments={pcl5Assessments}
              />
            </TabsContent>

            <TabsContent value="forms">
              <ClientFormsTab
                loading={tabLoading.forms}
                formResponses={formResponses}
                onViewResponse={handleViewFormResponse}
              />
            </TabsContent>

            <TabsContent value="insurance">
              <ClientInsuranceTab
                loading={tabLoading.insurance}
                insurance={insurance}
              />
            </TabsContent>

            <TabsContent value="contacts">
              <ClientContactsTab
                loading={tabLoading.contacts}
                emergencyContacts={emergencyContacts}
              />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
