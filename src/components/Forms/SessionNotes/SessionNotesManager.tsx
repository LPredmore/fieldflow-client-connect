import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FormBuilder } from '../FormBuilder/FormBuilder';
import { FormTemplate } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Copy, FileText, Loader2, Sparkles, Eye } from 'lucide-react';
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

const TEMPLATE_PRESETS = [
  {
    name: 'SOAP Note',
    description: 'Subjective, Objective, Assessment, Plan format',
    fields: [
      { label: 'Subjective', field_type: 'textarea', help_text: "Client's report of symptoms and concerns" },
      { label: 'Objective', field_type: 'textarea', help_text: 'Observable data and measurements' },
      { label: 'Assessment', field_type: 'textarea', help_text: 'Clinical impression and diagnosis' },
      { label: 'Plan', field_type: 'textarea', help_text: 'Treatment plan and next steps' },
    ],
  },
  {
    name: 'Progress Note',
    description: 'Track client progress and interventions',
    fields: [
      { label: 'Session Goals', field_type: 'textarea', is_required: true },
      { label: 'Interventions Used', field_type: 'textarea', is_required: true },
      { label: 'Client Response', field_type: 'textarea', is_required: true },
      {
        label: 'Progress Toward Goals',
        field_type: 'select',
        options: [
          { label: 'Significant Progress', value: 'significant' },
          { label: 'Moderate Progress', value: 'moderate' },
          { label: 'Minimal Progress', value: 'minimal' },
          { label: 'No Progress', value: 'none' },
        ],
        is_required: true,
      },
      { label: 'Next Session Plan', field_type: 'textarea', is_required: true },
    ],
  },
];

export function SessionNotesManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<FormTemplate | null>(null);
  const [viewingResponsesTemplate, setViewingResponsesTemplate] = useState<FormTemplate | null>(null);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [tenantId, setTenantId] = useState<string>('');

  // Load tenant ID
  useEffect(() => {
    const fetchTenantId = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();
      
      if (profile?.tenant_id) {
        setTenantId(profile.tenant_id);
      }
    };
    
    fetchTenantId();
  }, [user]);

  // Fetch session note templates
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
        .eq('form_type', 'session_notes')
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
        description: 'Failed to load session note templates',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplateId(null);
    setShowBuilder(true);
  };

  const handleCreateFromPreset = async (preset: typeof TEMPLATE_PRESETS[0]) => {
    if (!user || !tenantId) return;

    try {
      // Create template
      const { data: newTemplate, error: createError } = await supabase
        .from('form_templates')
        .insert({
          tenant_id: tenantId,
          form_type: 'session_notes',
          name: preset.name,
          description: preset.description,
          is_active: false,
          version: 1,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Create fields
      const fieldsToInsert = preset.fields.map((field, index) => ({
        form_template_id: newTemplate.id,
        field_type: field.field_type,
        field_key: field.label.toLowerCase().replace(/\s+/g, '_'),
        label: field.label,
        help_text: field.help_text,
        is_required: field.is_required || false,
        order_index: index,
        options: field.options,
      }));

      const { error: fieldsError } = await supabase
        .from('form_fields')
        .insert(fieldsToInsert);

      if (fieldsError) throw fieldsError;

      toast({
        title: 'Success',
        description: `${preset.name} template created successfully`,
      });

      setShowPresets(false);
      fetchTemplates();
    } catch (error: any) {
      console.error('Error creating preset template:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create template from preset',
      });
    }
  };

  const handleEdit = (templateId: string) => {
    setEditingTemplateId(templateId);
    setShowBuilder(true);
  };

  const handleDuplicate = async (template: FormTemplate) => {
    try {
      const { data: originalTemplate, error: fetchError } = await supabase
        .from('form_templates')
        .select(`*, form_fields (*)`)
        .eq('id', template.id)
        .single();

      if (fetchError) throw fetchError;

      const { data: newTemplate, error: createError } = await supabase
        .from('form_templates')
        .insert({
          tenant_id: template.tenant_id,
          form_type: 'session_notes',
          name: `${template.name} (Copy)`,
          description: template.description,
          is_active: false,
          version: 1,
          created_by_user_id: user?.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      if (originalTemplate.form_fields && originalTemplate.form_fields.length > 0) {
        const fieldsToInsert = originalTemplate.form_fields.map((field: any) => ({
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
          .from('form_fields')
          .insert(fieldsToInsert);

        if (fieldsError) throw fieldsError;
      }

      toast({
        title: 'Success',
        description: 'Template duplicated successfully',
      });

      fetchTemplates();
    } catch (error: any) {
      console.error('Error duplicating template:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to duplicate template',
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
        description: 'Template deleted successfully',
      });

      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete template',
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Session Note Templates</CardTitle>
              <CardDescription>
                Create templates for documenting therapy sessions and progress notes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPresets(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Use Preset
              </Button>
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create Custom
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">No session note templates yet</h3>
              <p className="text-muted-foreground mb-4">
                Create a template or use a preset to get started
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowPresets(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Use Preset
                </Button>
                <Button onClick={handleCreateNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Custom
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
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
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(template)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingTemplate(template)}
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
        </CardContent>
      </Card>

      {/* Preset Templates Dialog */}
      <Dialog open={showPresets} onOpenChange={setShowPresets}>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Choose a Preset Template</h2>
              <p className="text-sm text-muted-foreground">
                Start with a pre-built template that you can customize
              </p>
            </div>

            <div className="space-y-3">
              {TEMPLATE_PRESETS.map((preset) => (
                <Card key={preset.name} className="cursor-pointer hover:border-primary transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{preset.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {preset.description}
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleCreateFromPreset(preset)}
                      >
                        Use This
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground">
                      {preset.fields.length} fields included
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={handleBuilderClose}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto">
          <FormBuilder formType="session_notes" />
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingTemplate}
        onOpenChange={() => setDeletingTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
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
    </>
  );
}
