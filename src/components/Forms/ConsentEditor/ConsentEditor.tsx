import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ConsentTemplate, ConsentSection, ConsentContent, ConsentType } from '../types';
import { Save, Rocket, Plus, Trash2, GripVertical, Eye, Edit } from 'lucide-react';

interface ConsentEditorProps {
  template: ConsentTemplate | null;
  isSystemDefault: boolean;
  onSave: (data: Partial<ConsentTemplate>) => Promise<void>;
  onClose: () => void;
}

const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  telehealth_informed_consent: 'Telehealth Informed Consent',
  hipaa_notice: 'HIPAA Notice of Privacy Practices',
  privacy_practices: 'Privacy Practices',
  financial_agreement: 'Financial Agreement',
  custom: 'Custom Consent Form',
};

const SECTION_TYPE_LABELS = {
  text: 'Text Block',
  acknowledgment: 'Acknowledgment Checkbox',
  signature_block: 'Signature Block',
};

export function ConsentEditor({ template, isSystemDefault, onSave, onClose }: ConsentEditorProps) {
  const [title, setTitle] = useState(template?.title || '');
  const [consentType, setConsentType] = useState<ConsentType>(template?.consent_type || 'custom');
  const [sections, setSections] = useState<ConsentSection[]>(
    template?.content?.sections || []
  );
  const [isActive, setIsActive] = useState(template?.is_active || false);
  const [isRequired, setIsRequired] = useState(template?.is_required || false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');

  const generateId = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  const addSection = (type: ConsentSection['type']) => {
    const newSection: ConsentSection = {
      id: generateId(),
      type,
      title: type === 'signature_block' ? 'Signature' : '',
      content: type === 'acknowledgment' 
        ? 'I acknowledge that I have read and understand the above information.'
        : type === 'signature_block'
        ? 'By signing below, I agree to the terms outlined in this document.'
        : '',
      required: type !== 'text',
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (id: string, updates: Partial<ConsentSection>) => {
    setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === sections.length - 1)
    ) {
      return;
    }

    const newSections = [...sections];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    setSections(newSections);
  };

  const handleSave = async (publish: boolean) => {
    setSaving(true);
    try {
      const content: ConsentContent = { sections };
      await onSave({
        title,
        consent_type: consentType,
        content,
        is_active: publish ? true : isActive,
        is_required: isRequired,
        version: (template?.version || 0) + 1,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const renderSectionEditor = (section: ConsentSection, index: number) => (
    <Card key={section.id} className="mb-4">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
            <Badge variant="outline">{SECTION_TYPE_LABELS[section.type]}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveSection(index, 'up')}
              disabled={index === 0}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveSection(index, 'down')}
              disabled={index === sections.length - 1}
            >
              ↓
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteSection(section.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-3 px-4 space-y-3">
        {section.type !== 'signature_block' && (
          <div className="space-y-2">
            <Label>Section Title (optional)</Label>
            <Input
              value={section.title || ''}
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
              placeholder="Enter section title"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label>
            {section.type === 'text' ? 'Content' : 
             section.type === 'acknowledgment' ? 'Acknowledgment Text' : 
             'Signature Instructions'}
          </Label>
          <Textarea
            value={section.content}
            onChange={(e) => updateSection(section.id, { content: e.target.value })}
            placeholder={
              section.type === 'text' ? 'Enter the consent document text...' :
              section.type === 'acknowledgment' ? 'Enter the text for the acknowledgment checkbox...' :
              'Enter instructions for the signature...'
            }
            rows={section.type === 'text' ? 6 : 3}
          />
        </div>
        {section.type !== 'text' && (
          <div className="flex items-center gap-2">
            <Switch
              checked={section.required}
              onCheckedChange={(checked) => updateSection(section.id, { required: checked })}
            />
            <Label>Required</Label>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderPreview = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{title || 'Untitled Consent Form'}</CardTitle>
        <CardDescription>{CONSENT_TYPE_LABELS[consentType]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {sections.map((section) => (
          <div key={section.id}>
            {section.title && (
              <h3 className="font-semibold mb-2">{section.title}</h3>
            )}
            {section.type === 'text' && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {section.content}
              </p>
            )}
            {section.type === 'acknowledgment' && (
              <div className="flex items-start gap-3 p-3 border rounded-md bg-muted/50">
                <input type="checkbox" disabled className="mt-1" />
                <span className="text-sm">{section.content}</span>
                {section.required && <span className="text-destructive">*</span>}
              </div>
            )}
            {section.type === 'signature_block' && (
              <div className="space-y-2 p-4 border rounded-md">
                <p className="text-sm text-muted-foreground">{section.content}</p>
                <div className="border-b-2 border-foreground h-8 mt-4" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Signature</span>
                  <span>Date</span>
                </div>
              </div>
            )}
          </div>
        ))}
        {sections.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No sections added yet. Use the editor to add content.
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Form Settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isSystemDefault ? 'View Default Template' : template ? 'Edit Consent Template' : 'Create Consent Template'}
          </CardTitle>
          <CardDescription>
            {isSystemDefault 
              ? 'This is a default template. Customize a copy to use it with your clients.'
              : 'Configure your consent form details'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Template Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter template title"
                disabled={isSystemDefault}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consent-type">Consent Type</Label>
              <Select
                value={consentType}
                onValueChange={(value) => setConsentType(value as ConsentType)}
                disabled={isSystemDefault}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select consent type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONSENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isSystemDefault && (
            <div className="space-y-4">
              {/* Required Toggle */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="is-required" className="text-sm font-medium">Mark as Required</Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, this consent will be automatically required for all new clients
                  </p>
                </div>
                <Switch
                  id="is-required"
                  checked={isRequired}
                  onCheckedChange={setIsRequired}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleSave(false)}
                  disabled={saving || !title}
                  variant="outline"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleSave(true)}
                  disabled={saving || !title || sections.length === 0}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  Publish
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                {template?.is_active && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ✓ Currently Active
                  </span>
                )}
              </div>
            </div>
          )}

          {isSystemDefault && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Content Editor with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="edit" disabled={isSystemDefault}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-4">
          <div className="grid grid-cols-12 gap-4">
            {/* Section Palette */}
            <div className="col-span-12 lg:col-span-3">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Add Section</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addSection('text')}
                    disabled={isSystemDefault}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Text Block
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addSection('acknowledgment')}
                    disabled={isSystemDefault}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Acknowledgment
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addSection('signature_block')}
                    disabled={isSystemDefault}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Signature Block
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Section Editor */}
            <div className="col-span-12 lg:col-span-9">
              {sections.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground mb-4">
                      No sections yet. Add text blocks, acknowledgments, or signature blocks.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sections.map((section, index) => renderSectionEditor(section, index))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          {renderPreview()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
