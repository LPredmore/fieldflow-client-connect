import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Pencil, 
  User, 
  Stethoscope, 
  ClipboardCheck, 
  FileText, 
  CreditCard, 
  Users,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { useClientDetail, ClientDetailTab, FormResponseWithTemplate, SessionNote, CompletedDocument, ClientHistoryForm, ClientTelehealthConsent } from '@/hooks/useClientDetail';
import { useClientFormAssignments } from '@/hooks/useClientFormAssignments';
import { useClientConsentStatus } from '@/hooks/useClientConsentStatus';
import { getClientDisplayName } from '@/utils/clientDisplayName';
import { useAuth } from '@/hooks/useAuth';
import {
  ClientOverviewTab,
  ClientClinicalTab,
  ClientAssessmentsTab,
  ClientFormsTab,
  ClientInsuranceTab,
  ClientContactsTab,
  AssignFormDialog,
} from '@/components/Clients/ClientDetail';
import { ClientForm } from '@/components/Clients/ClientForm';
import { TreatmentPlanDialog } from '@/components/Clinical/TreatmentPlanDialog';
import { SessionNoteViewDialog } from '@/components/Clinical/SessionNoteViewDialog';
import { BatchSessionNotePrintDialog } from '@/components/Clinical/BatchSessionNotePrintDialog';
import { ResponseDetailDialog } from '@/components/Forms/Responses/ResponseDetailDialog';
import { ClientFormData } from '@/types/client';
import { useClients } from '@/hooks/useClients';

// Helper to format consent template keys into readable names
function formatConsentName(key: string): string {
  const nameMap: Record<string, string> = {
    'treatment_consent': 'Consent for Treatment',
    'hipaa_notice': 'HIPAA Notice',
    'financial_agreement': 'Financial Agreement',
    'telehealth_informed_consent': 'Telehealth Informed Consent',
  };
  return nameMap[key] || key.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { updateClient } = useClients();

  // Determine back navigation based on origin route
  const isAdminView = location.pathname.includes('/allclients');
  const backPath = isAdminView ? '/staff/allclients' : '/staff/clients';

  // Tab state
  const [activeTab, setActiveTab] = useState<ClientDetailTab>('overview');

  // Dialog states
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [treatmentPlanMode, setTreatmentPlanMode] = useState<'closed' | 'edit' | 'create'>('closed');
  const [isAssignFormOpen, setIsAssignFormOpen] = useState(false);
  const [viewingSessionNote, setViewingSessionNote] = useState<SessionNote | null>(null);
  const [batchPrintNoteIds, setBatchPrintNoteIds] = useState<string[]>([]);
  const [viewingFormResponse, setViewingFormResponse] = useState<{
    response: FormResponseWithTemplate;
    template: { id: string; name: string; description: string | null };
    customer: {
      pat_name_f: string | null;
      pat_name_l: string | null;
      pat_name_m: string | null;
      preferred_name: string | null;
      email: string | null;
      full_name?: string;
    };
  } | null>(null);
  
  // New dialog states for history forms and consents
  const [viewingHistoryForm, setViewingHistoryForm] = useState<ClientHistoryForm | null>(null);
  const [viewingConsent, setViewingConsent] = useState<ClientTelehealthConsent | null>(null);

  // Fetch client data with lazy loading per tab
  const {
    client,
    clientLoading,
    clientError,
    currentTreatmentPlan,
    activeDiagnoses,
    sessionNotes,
    phq9Assessments,
    gad7Assessments,
    pcl5Assessments,
    completedDocuments,
    formResponses,
    insurance,
    emergencyContacts,
    tabLoading,
    refetchTreatmentPlans,
  } = useClientDetail({ clientId: clientId ?? null, activeTab });

  // Fetch form assignments
  const {
    assignments: formAssignments,
    pendingAssignments,
    loading: assignmentsLoading,
    assignForm,
    cancelAssignment,
    fetchAssignments,
  } = useClientFormAssignments({ 
    clientId: clientId ?? null, 
    enabled: activeTab === 'forms' 
  });

  // Fetch form assignments
  useEffect(() => {
    if (activeTab === 'forms' && clientId) {
      fetchAssignments();
    }
  }, [activeTab, clientId, fetchAssignments]);

  // Fetch consent status (always enabled for forms tab)
  const {
    consentStatuses,
    loading: consentLoading,
    signedCount,
    requiredCount,
    isFullyCompliant,
  } = useClientConsentStatus({
    clientId: clientId ?? null,
    enabled: activeTab === 'forms',
  });

  // Get clinician name for treatment plan
  const clinicianName = user?.staffAttributes?.staffData 
    ? `${user.staffAttributes.staffData.prov_name_f || ''} ${user.staffAttributes.staffData.prov_name_l || ''}`.trim()
    : '';

  const handleTabChange = (value: string) => {
    setActiveTab(value as ClientDetailTab);
  };

  const handleBack = () => {
    navigate(backPath);
  };

  const handleViewTreatmentPlan = () => {
    setTreatmentPlanMode('edit');
  };

  const handleCreateNewTreatmentPlan = () => {
    setTreatmentPlanMode('create');
  };

  const handleViewSessionNote = (noteId: string) => {
    const note = sessionNotes.find(n => n.id === noteId);
    if (note) {
      setViewingSessionNote(note);
    }
  };

  const handlePrintSelectedNotes = (noteIds: string[]) => {
    setBatchPrintNoteIds(noteIds);
  };

  const handleViewFormResponse = (response: FormResponseWithTemplate) => {
    if (!client || !response.form_template) return;
    
    // Transform to match ResponseDetailDialog expected format
    setViewingFormResponse({
      response,
      template: {
        id: response.form_template.id,
        name: response.form_template.name,
        description: response.form_template.description,
      },
      customer: {
        pat_name_f: client.pat_name_f,
        pat_name_l: client.pat_name_l,
        pat_name_m: client.pat_name_m ?? null,
        preferred_name: client.pat_name_preferred ?? null,
        email: client.email ?? null,
        full_name: client.full_name,
      },
    });
  };

  // Unified document viewing handler
  const handleViewDocument = (doc: CompletedDocument) => {
    switch (doc.sourceData.type) {
      case 'form_response':
        handleViewFormResponse(doc.sourceData.data);
        break;
      case 'history_form':
        setViewingHistoryForm(doc.sourceData.data);
        break;
      case 'consent':
        setViewingConsent(doc.sourceData.data);
        break;
    }
  };

  const handleEditClient = async (data: ClientFormData) => {
    if (client) {
      await updateClient(client.id, data);
      setIsEditFormOpen(false);
    }
  };

  // Error state
  if (clientError) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={handleBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </Button>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <h3 className="mt-4 text-lg font-medium text-foreground">Error Loading Client</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Unable to load client details. The client may not exist or you may not have permission to view it.
              </p>
              <Button onClick={handleBack} className="mt-4">
                Return to Clients
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (clientLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Not found state
  if (!client) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={handleBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </Button>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <User className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium text-foreground">Client Not Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The client you're looking for doesn't exist or has been removed.
              </p>
              <Button onClick={handleBack} className="mt-4">
                Return to Clients
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {getClientDisplayName(client)}
              </h1>
              <p className="text-sm text-muted-foreground">
                {client.email && <span>{client.email}</span>}
                {client.email && client.phone && <span> • </span>}
                {client.phone && <span>{client.phone}</span>}
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setIsEditFormOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Client
        </Button>
      </div>

      {/* Tabs */}
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
            <span className="hidden sm:inline">Forms & Consents</span>
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
            onCreateNewPlan={handleCreateNewTreatmentPlan}
            onViewSessionNote={handleViewSessionNote}
            onPrintSelectedNotes={handlePrintSelectedNotes}
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
            completedDocuments={completedDocuments}
            formAssignments={formAssignments}
            assignmentsLoading={assignmentsLoading}
            onViewDocument={handleViewDocument}
            onAssignForm={() => setIsAssignFormOpen(true)}
            onCancelAssignment={cancelAssignment}
            consentStatuses={consentStatuses}
            consentLoading={consentLoading}
            signedCount={signedCount}
            requiredCount={requiredCount}
            isFullyCompliant={isFullyCompliant}
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

      {/* Edit Client Dialog */}
      <ClientForm
        open={isEditFormOpen}
        onOpenChange={setIsEditFormOpen}
        onSubmit={handleEditClient}
        client={client}
        title="Edit Client"
      />

      {/* Treatment Plan Dialog */}
      <TreatmentPlanDialog
        open={treatmentPlanMode !== 'closed'}
        onOpenChange={(open) => { if (!open) setTreatmentPlanMode('closed'); }}
        clientId={client.id}
        clinicianName={clinicianName}
        existingPlan={treatmentPlanMode === 'edit' ? currentTreatmentPlan : null}
        onSaved={refetchTreatmentPlans}
      />

      {/* Session Note View Dialog */}
      <SessionNoteViewDialog
        open={!!viewingSessionNote && batchPrintNoteIds.length === 0}
        onOpenChange={(open) => !open && setViewingSessionNote(null)}
        sessionNote={viewingSessionNote}
      />

      {/* Batch Session Notes Print Dialog */}
      <BatchSessionNotePrintDialog
        open={batchPrintNoteIds.length > 0}
        onOpenChange={(open) => !open && setBatchPrintNoteIds([])}
        noteIds={batchPrintNoteIds}
        clientId={client.id}
      />

      {viewingFormResponse && (
        <ResponseDetailDialog
          open={!!viewingFormResponse}
          onOpenChange={(open) => !open && setViewingFormResponse(null)}
          response={{
            id: viewingFormResponse.response.id,
            response_data: viewingFormResponse.response.response_data,
            submitted_at: viewingFormResponse.response.submitted_at,
            customer: viewingFormResponse.customer,
          }}
          template={{
            ...viewingFormResponse.template,
            tenant_id: '',
            is_active: true,
          }}
        />
      )}

      {/* History Form View Dialog */}
      <Dialog open={!!viewingHistoryForm} onOpenChange={(open) => !open && setViewingHistoryForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Client History Intake Form
            </DialogTitle>
            <DialogDescription>
              Submitted intake questionnaire for this client.
            </DialogDescription>
          </DialogHeader>
          {viewingHistoryForm && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>
                  Submitted on {format(new Date(viewingHistoryForm.submission_date || viewingHistoryForm.created_at), 'MMMM d, yyyy')}
                </span>
              </div>
              {viewingHistoryForm.signature && (
                <div className="border rounded-md p-3 bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Signature</p>
                  <p className="text-sm font-medium">{viewingHistoryForm.signature}</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                The full intake form data is available in the client's clinical records.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Consent View Dialog */}
      <Dialog open={!!viewingConsent} onOpenChange={(open) => !open && setViewingConsent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingConsent ? formatConsentName(viewingConsent.consent_template_key) : 'Consent Document'}
            </DialogTitle>
            <DialogDescription>
              Signed consent document details.
            </DialogDescription>
          </DialogHeader>
          {viewingConsent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>
                  Signed on {format(new Date(viewingConsent.signed_at), 'MMMM d, yyyy \'at\' h:mm a')}
                </span>
              </div>
              <div className="border rounded-md p-3 bg-muted/50 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Consent Type</p>
                  <p className="text-sm font-medium">{formatConsentName(viewingConsent.consent_template_key)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="text-sm font-medium">{viewingConsent.consent_template_version}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Signature Date</p>
                  <p className="text-sm font-medium">{format(new Date(viewingConsent.signature_date), 'MMMM d, yyyy')}</p>
                </div>
              </div>
              {viewingConsent.is_revoked && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    This consent was revoked on {viewingConsent.revoked_at ? format(new Date(viewingConsent.revoked_at), 'MMMM d, yyyy') : 'an unknown date'}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Form Dialog */}
      <AssignFormDialog
        open={isAssignFormOpen}
        onOpenChange={setIsAssignFormOpen}
        clientId={client.id}
        pendingTemplateIds={pendingAssignments.map(a => a.form_template_id)}
        onAssign={assignForm}
      />
    </div>
  );
}
