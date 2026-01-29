import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FormBuilder } from '../FormBuilder/FormBuilder';
import { ConsentEditor } from '../ConsentEditor/ConsentEditor';
import { FormTemplate, ConsentTemplate } from '../types';
import { useConsentTemplatesData } from '@/hooks/forms/useConsentTemplatesData';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Copy, FileText, Loader2, Eye, Library, Shield, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ResponseViewer } from '../Responses/ResponseViewer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CONSENT_TYPE_LABELS: Record<string, string> = {
  telehealth_informed_consent: 'Telehealth Consent',
  hipaa_notice: 'HIPAA Notice',
  privacy_practices: 'Privacy Practices',
  financial_agreement: 'Financial Agreement',
  custom: 'Custom',
};

export function FormLibrary() {
  const { user, tenantId: authTenantId } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<FormTemplate | null>(null);
  const [viewingResponsesTemplate, setViewingResponsesTemplate] = useState<FormTemplate | null>(null);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [tenantId, setTenantId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('forms');

  // Consent Templates
  const { 
    templates: consentTemplates, 
    loading: consentLoading, 
    createTemplate: createConsentTemplate,
    updateTemplate: updateConsentTemplate,
    deleteTemplate: deleteConsentTemplate,
    customizeSystemDefault,
  } = useConsentTemplatesData();
  const [showConsentEditor, setShowConsentEditor] = useState(false);
  const [editingConsentTemplate, setEditingConsentTemplate] = useState<ConsentTemplate | null>(null);
  const [deletingConsentTemplate, setDeletingConsentTemplate] = useState<ConsentTemplate | null>(null);

  // Get tenant ID from auth context
  useEffect(() => {
    if (authTenantId) {
      setTenantId(authTenantId);
    }
  }, [authTenantId]);

  // Fetch all templates
  useEffect(() => {
    if (tenantId) {
      fetchTemplates();
    }
  }, [tenantId]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);

      // Fetch response counts
      if (data && data.length > 0) {
        const counts: Record<string, number> = {};
        await Promise.all(
          data.map(async (template) => {
            const { count } = await supabase
              .from('form_responses')
              .select('*', { count: 'exact', head: true })
              .eq('form_template_id', template.id);
            counts[template.id!] = count || 0;
          })
        );
        setResponseCounts(counts);
      }
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load forms',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplateId(null);
    setShowBuilder(true);
  };

  const handleEdit = (templateId: string) => {
    setEditingTemplateId(templateId);
    setShowBuilder(true);
  };

  const handleDuplicate = async (template: FormTemplate) => {
    try {
      // Fetch the template with fields
      const { data: originalTemplate, error: fetchError } = await supabase
        .from('form_templates')
        .select(`
          *,
          form_template_fields (*)
        `)
        .eq('id', template.id)
        .single();

      if (fetchError) throw fetchError;

      // Create new template
      const { data: newTemplate, error: createError } = await supabase
        .from('form_templates')
        .insert({
          tenant_id: template.tenant_id,
          form_type: template.form_type || 'custom',
          name: `${template.name} (Copy)`,
          description: template.description,
          is_active: false,
          version: 1,
          created_by_user_id: user?.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Duplicate fields if they exist
      if (originalTemplate.form_template_fields && originalTemplate.form_template_fields.length > 0) {
        const fieldsToInsert = originalTemplate.form_template_fields.map((field: any) => ({
          form_template_id: newTemplate.id,
          field_type: field.field_type,
          field_key: field.field_key,
          label: field.label,
          placeholder: field.placeholder,
          help_text: field.help_text,
          is_required: field.is_required,
          order_index: field.order_index,
          validation_rules: field.validation_rules,
          options: field.options,
          conditional_logic: field.conditional_logic,
        }));

        const { error: fieldsError } = await supabase
          .from('form_template_fields')
          .insert(fieldsToInsert);

        if (fieldsError) throw fieldsError;
      }

      toast({
        title: 'Success',
        description: 'Form duplicated successfully',
      });

      fetchTemplates();
    } catch (error: any) {
      console.error('Error duplicating template:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to duplicate form',
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;

    try {
      const { error } = await supabase
        .from('form_templates')
        .delete()
        .eq('id', deletingTemplate.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Form deleted successfully',
      });

      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete form',
      });
    } finally {
      setDeletingTemplate(null);
    }
  };

  const handleBuilderClose = () => {
    setShowBuilder(false);
    setEditingTemplateId(null);
    fetchTemplates();
  };

  const getFormTypeBadge = (formType?: string) => {
    switch (formType) {
      case 'signup':
        return <Badge variant="outline" className="bg-primary/10">Sign-Up</Badge>;
      case 'intake':
        return <Badge variant="outline" className="bg-secondary/10">Intake</Badge>;
      case 'custom':
      default:
        return <Badge variant="outline">Custom</Badge>;
    }
  };

  // Consent Template Handlers
  const handleCreateNewConsent = () => {
    setEditingConsentTemplate(null);
    setShowConsentEditor(true);
  };

  const handleEditConsent = (template: ConsentTemplate) => {
    setEditingConsentTemplate(template);
    setShowConsentEditor(true);
  };

  const handleCustomizeSystemDefault = async (template: ConsentTemplate) => {
    const customized = await customizeSystemDefault(template.id);
    if (customized) {
      setEditingConsentTemplate(customized);
      setShowConsentEditor(true);
    }
  };

  const handleSaveConsent = async (data: Partial<ConsentTemplate>) => {
    if (editingConsentTemplate) {
      await updateConsentTemplate(editingConsentTemplate.id, data);
    } else {
      await createConsentTemplate(data);
    }
  };

  const handleDeleteConsent = async () => {
    if (!deletingConsentTemplate) return;
    await deleteConsentTemplate(deletingConsentTemplate.id);
    setDeletingConsentTemplate(null);
  };

  const handleConsentEditorClose = () => {
    setShowConsentEditor(false);
    setEditingConsentTemplate(null);
  };

  // Separate system defaults from tenant templates
  const systemConsentTemplates = consentTemplates.filter(t => t.is_system_default);
  const tenantConsentTemplates = consentTemplates.filter(t => !t.is_system_default);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Library className="h-5 w-5" />
                Form Library
              </CardTitle>
              <CardDescription>
                Manage custom forms and consent templates
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="forms" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Custom Forms
              </TabsTrigger>
              <TabsTrigger value="consents" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Consent Templates
              </TabsTrigger>
            </TabsList>

            {/* Custom Forms Tab */}
            <TabsContent value="forms">
              <div className="flex justify-end mb-4">
                <Button onClick={handleCreateNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Form
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium text-lg mb-2">No forms yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first form to start collecting data
                  </p>
                  <Button onClick={handleCreateNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Form
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Responses</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {template.description || '-'}
                        </TableCell>
                        <TableCell>
                          {getFormTypeBadge(template.form_type)}
                        </TableCell>
                        <TableCell>
                          {template.is_active ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingResponsesTemplate(template)}
                            className="h-8 px-2"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {responseCounts[template.id!] || 0}
                          </Button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {template.updated_at
                            ? format(new Date(template.updated_at), 'MMM d, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(template.id!)}
                              title="Edit form"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDuplicate(template)}
                              title="Duplicate form"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingTemplate(template)}
                              title="Delete form"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Consent Templates Tab */}
            <TabsContent value="consents">
              <div className="flex justify-end mb-4">
                <Button onClick={handleCreateNewConsent}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Consent Template
                </Button>
              </div>

              {consentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* System Defaults Section */}
                  {systemConsentTemplates.length > 0 && (
                    <div>
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          System Defaults
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Templates you can customize for your practice. Click "Customize" to create your own version.
                        </p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {systemConsentTemplates.map((template) => (
                            <TableRow key={template.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {template.title}
                                  {template.is_required && (
                                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                                      Required
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {CONSENT_TYPE_LABELS[template.consent_type] || template.consent_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                v{template.version}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditConsent(template)}
                                    title="View template"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCustomizeSystemDefault(template)}
                                    title="Create customizable copy"
                                  >
                                    Customize
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Tenant Templates Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                      Your Templates
                    </h3>
                    {tenantConsentTemplates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
                        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-medium text-lg mb-2">No custom consent templates</h3>
                        <p className="text-muted-foreground mb-4">
                          Create your own or customize a system default
                        </p>
                        <Button onClick={handleCreateNewConsent}>
                          <Plus className="mr-2 h-4 w-4" />
                          Create Consent Template
                        </Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tenantConsentTemplates.map((template) => (
                            <TableRow key={template.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {template.title}
                                  {template.is_required && (
                                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                                      Required
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {CONSENT_TYPE_LABELS[template.consent_type] || template.consent_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {template.is_active ? (
                                  <Badge variant="default">Active</Badge>
                                ) : (
                                  <Badge variant="secondary">Draft</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                v{template.version}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {template.updated_at
                                  ? format(new Date(template.updated_at), 'MMM d, yyyy')
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditConsent(template)}
                                    title="Edit template"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeletingConsentTemplate(template)}
                                    title="Delete template"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Form Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={handleBuilderClose}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto">
          <FormBuilder 
            templateId={editingTemplateId || undefined}
            onSaveComplete={handleBuilderClose}
          />
        </DialogContent>
      </Dialog>

      {/* Consent Editor Dialog */}
      <Dialog open={showConsentEditor} onOpenChange={handleConsentEditorClose}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto">
          <ConsentEditor
            template={editingConsentTemplate}
            isSystemDefault={editingConsentTemplate?.is_system_default || false}
            onSave={handleSaveConsent}
            onClose={handleConsentEditorClose}
          />
        </DialogContent>
      </Dialog>

      {/* Response Viewer */}
      {viewingResponsesTemplate && (
        <Dialog open={!!viewingResponsesTemplate} onOpenChange={(open) => !open && setViewingResponsesTemplate(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto p-0">
            <ResponseViewer
              template={viewingResponsesTemplate}
              onClose={() => setViewingResponsesTemplate(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Form Confirmation Dialog */}
      <AlertDialog
        open={!!deletingTemplate}
        onOpenChange={() => setDeletingTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTemplate?.name}"? This action cannot be
              undone and will delete all associated fields and responses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Consent Template Confirmation Dialog */}
      <AlertDialog
        open={!!deletingConsentTemplate}
        onOpenChange={() => setDeletingConsentTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Consent Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingConsentTemplate?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConsent} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
