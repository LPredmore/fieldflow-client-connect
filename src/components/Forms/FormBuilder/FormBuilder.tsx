import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFormTemplate } from '../hooks/useFormTemplate';
import { useFormBuilder } from '../hooks/useFormBuilder';
import { FieldPalette } from './FieldPalette';
import { FormCanvas } from './FormCanvas';
import { FieldEditor } from './FieldEditor';
import { FormPreview } from './FormPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Rocket, Edit, Eye } from 'lucide-react';
import { FormTemplate } from '../types';

interface FormBuilderProps {
  formType: 'signup' | 'intake' | 'session_notes';
}

export function FormBuilder({ formType }: FormBuilderProps) {
  const { user, userRole } = useAuth();
  const { template, fields: loadedFields, loading, loadTemplate, saveTemplate } = useFormTemplate();
  const {
    fields,
    selectedFieldId,
    addField,
    updateField,
    deleteField,
    duplicateField,
    reorderFields,
    selectField,
    setFields,
    getSelectedField,
  } = useFormBuilder();

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [tenantId, setTenantId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Load tenant ID
  useEffect(() => {
    const fetchTenantId = async () => {
      if (!user) return;
      
      const { data: profile } = await import('@/integrations/supabase/client')
        .then(m => m.supabase.from('profiles').select('tenant_id').eq('user_id', user.id).single());
      
      if (profile?.tenant_id) {
        setTenantId(profile.tenant_id);
      }
    };
    
    fetchTenantId();
  }, [user]);

  // Load existing template
  useEffect(() => {
    if (tenantId) {
      loadTemplate(formType, tenantId);
    }
  }, [formType, tenantId, loadTemplate]);

  // Update form builder when template loads
  useEffect(() => {
    if (template) {
      setFormName(template.name);
      setFormDescription(template.description || '');
      setFields(loadedFields);
    }
  }, [template, loadedFields, setFields]);

  const handleSave = async (activate: boolean) => {
    if (!tenantId || !user) return;
    
    setSaving(true);

    const templateData: FormTemplate = {
      id: template?.id,
      tenant_id: tenantId,
      form_type: formType,
      name: formName || `${formType} Form`,
      description: formDescription,
      is_active: activate,
      version: template?.version || 1,
      created_by_user_id: user.id,
    };

    await saveTemplate(templateData, fields);
    setSaving(false);
  };

  if (loading && !template) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Form Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Form Settings</CardTitle>
          <CardDescription>Configure your form details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="form-name">Form Name</Label>
              <Input
                id="form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter form name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-description">Description</Label>
              <Textarea
                id="form-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Enter form description"
                rows={1}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleSave(false)}
              disabled={saving || !formName}
              variant="outline"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving || !formName || fields.length === 0}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
              Publish Form
            </Button>
            {template?.is_active && (
              <span className="text-sm text-muted-foreground ml-2">
                ✓ Currently Active
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Builder with Tabs */}
      <Tabs defaultValue="build" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="build">
            <Edit className="h-4 w-4 mr-2" />
            Build
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="mt-4">
          <div className="grid grid-cols-12 gap-4">
            {/* Left - Field Palette */}
            <div className="col-span-12 lg:col-span-3">
              <FieldPalette onAddField={addField} />
            </div>

            {/* Center - Form Canvas */}
            <div className="col-span-12 lg:col-span-5">
              <FormCanvas
                fields={fields}
                selectedFieldId={selectedFieldId}
                onSelectField={selectField}
                onDeleteField={deleteField}
                onDuplicateField={duplicateField}
                onReorderFields={reorderFields}
              />
            </div>

            {/* Right - Field Editor */}
            <div className="col-span-12 lg:col-span-4">
              <FieldEditor
                field={getSelectedField()}
                onUpdateField={updateField}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <div className="max-w-3xl mx-auto">
            <FormPreview fields={fields} formName={formName} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
