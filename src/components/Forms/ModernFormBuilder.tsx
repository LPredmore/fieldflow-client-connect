import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFormContext } from '@/contexts/FormContext';
import { useFormBuilder } from './hooks/useFormBuilder';
import { FieldPalette } from './FormBuilder/FieldPalette';
import { FormCanvas } from './FormBuilder/FormCanvas';
import { FieldEditor } from './FormBuilder/FieldEditor';
import { UnifiedFormRenderer } from './UnifiedFormRenderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Rocket, Edit, Eye } from 'lucide-react';
import { FormTemplate } from './types';
import { useToast } from '@/hooks/use-toast';

interface ModernFormBuilderProps {
  formType: 'signup' | 'intake' | 'session_notes';
  templateId?: string;
}

export function ModernFormBuilder({ formType, templateId }: ModernFormBuilderProps) {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const {
    templates,
    templatesLoading,
    createTemplate,
    updateTemplate,
    fields,
    fieldsLoading,
    createField,
    updateField,
    deleteField,
    activeTemplateId,
    setActiveTemplateId,
    getTemplateByType,
  } = useFormContext();

  const {
    fields: builderFields,
    selectedFieldId,
    addField,
    updateField: updateBuilderField,
    deleteField: deleteBuilderField,
    duplicateField,
    reorderFields,
    selectField,
    setFields,
    getSelectedField,
  } = useFormBuilder();

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<FormTemplate | null>(null);

  // Load existing template if templateId provided
  useEffect(() => {
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setCurrentTemplate(template);
        setFormName(template.name);
        setFormDescription(template.description || '');
        setActiveTemplateId(templateId);
      }
    } else {
      // Look for existing template of this type
      const existingTemplate = getTemplateByType(formType);
      if (existingTemplate) {
        setCurrentTemplate(existingTemplate);
        setFormName(existingTemplate.name);
        setFormDescription(existingTemplate.description || '');
        setActiveTemplateId(existingTemplate.id!);
      }
    }
  }, [templateId, templates, formType, getTemplateByType, setActiveTemplateId]);

  // Sync fields when they load
  useEffect(() => {
    if (fields.length > 0) {
      setFields(fields);
    }
  }, [fields, setFields]);

  const handleSave = async (isActive: boolean = false) => {
    if (!user || !tenantId) return;

    setSaving(true);
    try {
      const templateData = {
        tenant_id: tenantId,
        form_type: formType,
        name: formName,
        description: formDescription,
        is_active: isActive,
        version: currentTemplate ? (currentTemplate.version || 1) + 1 : 1,
      };

      let savedTemplate;
      if (currentTemplate?.id) {
        // Update existing template
        const result = await updateTemplate({ id: currentTemplate.id, ...templateData });
        savedTemplate = result.data;
      } else {
        // Create new template
        const result = await createTemplate(templateData);
        savedTemplate = result.data;
        setCurrentTemplate(savedTemplate);
        setActiveTemplateId(savedTemplate.id);
      }

      // Save fields
      if (savedTemplate?.id) {
        // Delete existing fields and recreate (simpler than complex diff)
        for (const field of fields) {
          await deleteField(field.id);
        }

        // Create new fields
        for (const field of builderFields) {
          const fieldData = {
            form_template_id: savedTemplate.id,
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
          };
          await createField(fieldData);
        }
      }

      toast({
        title: 'Success',
        description: isActive ? 'Form published successfully' : 'Form saved as draft',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save form',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFieldUpdate = async (id: string, updates: any) => {
    updateBuilderField(id, updates);
    
    // If this is an existing field, update in database
    const existingField = fields.find(f => f.id === id);
    if (existingField) {
      await updateField({ id, ...updates });
    }
  };

  const handleFieldDelete = async (id: string) => {
    deleteBuilderField(id);
    
    // If this is an existing field, delete from database
    const existingField = fields.find(f => f.id === id);
    if (existingField) {
      await deleteField(id);
    }
  };

  const handlePreviewSubmit = async (data: Record<string, any>) => {
    console.log('Preview form submission:', data);
    toast({
      title: 'Preview Submission',
      description: 'This is a preview - data was not actually saved.',
    });
  };

  if (templatesLoading || fieldsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Form Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Form Settings</CardTitle>
          <CardDescription>
            Configure the basic settings for your {formType} form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="form-name">Form Name</Label>
            <Input
              id="form-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Enter form name..."
            />
          </div>
          <div>
            <Label htmlFor="form-description">Description</Label>
            <Textarea
              id="form-description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Enter form description..."
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleSave(false)}
              disabled={saving || !formName}
              variant="outline"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving || !formName || builderFields.length === 0}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Rocket className="w-4 h-4 mr-2" />
              Publish Form
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Form Builder */}
      <Tabs defaultValue="build" className="space-y-4">
        <TabsList>
          <TabsTrigger value="build">
            <Edit className="w-4 h-4 mr-2" />
            Build
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Field Palette */}
            <div className="lg:col-span-1">
              <FieldPalette onAddField={addField} />
            </div>

            {/* Form Canvas */}
            <div className="lg:col-span-2">
              <FormCanvas
                fields={builderFields}
                selectedFieldId={selectedFieldId}
                onSelectField={selectField}
                onDeleteField={handleFieldDelete}
                onDuplicateField={duplicateField}
                onReorderFields={reorderFields}
              />
            </div>

            {/* Field Editor */}
            <div className="lg:col-span-1">
              <FieldEditor
                field={getSelectedField()}
                onUpdateField={handleFieldUpdate}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          {formName && builderFields.length > 0 ? (
            <UnifiedFormRenderer
              template={{
                id: currentTemplate?.id,
                tenant_id: tenantId || '',
                form_type: formType,
                name: formName,
                description: formDescription,
                is_active: false,
              }}
              fields={builderFields}
              onSubmit={handlePreviewSubmit}
              submitButtonText="Submit (Preview)"
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  Add a form name and some fields to see the preview
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}