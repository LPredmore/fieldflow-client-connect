import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FormField, FieldOption } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface FieldEditorProps {
  field: FormField | undefined;
  onUpdateField: (id: string, updates: Partial<FormField>) => void;
}

export function FieldEditor({ field, onUpdateField }: FieldEditorProps) {
  if (!field) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Field Properties</CardTitle>
          <CardDescription>Select a field to edit its properties</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground text-sm text-center">
            Click on a field in the canvas<br />to edit its properties
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(field.field_type);

  const handleAddOption = () => {
    const currentOptions = field.options || [];
    const newOption: FieldOption = {
      label: `Option ${currentOptions.length + 1}`,
      value: `option_${currentOptions.length + 1}`,
    };
    onUpdateField(field.id, {
      options: [...currentOptions, newOption],
    });
  };

  const handleUpdateOption = (index: number, updates: Partial<FieldOption>) => {
    const currentOptions = [...(field.options || [])];
    currentOptions[index] = { ...currentOptions[index], ...updates };
    onUpdateField(field.id, { options: currentOptions });
  };

  const handleDeleteOption = (index: number) => {
    const currentOptions = [...(field.options || [])];
    currentOptions.splice(index, 1);
    onUpdateField(field.id, { options: currentOptions });
  };

  return (
    <Card className="h-full overflow-auto">
      <CardHeader>
        <CardTitle className="text-lg">Field Properties</CardTitle>
        <CardDescription>Configure the selected field</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Label */}
        <div className="space-y-2">
          <Label htmlFor="field-label">Label *</Label>
          <Input
            id="field-label"
            value={field.label}
            onChange={(e) => onUpdateField(field.id, { label: e.target.value })}
            placeholder="Enter field label"
          />
        </div>

        {/* Field Key */}
        <div className="space-y-2">
          <Label htmlFor="field-key">Field Key</Label>
          <Input
            id="field-key"
            value={field.field_key}
            onChange={(e) => onUpdateField(field.id, { field_key: e.target.value })}
            placeholder="field_key"
          />
          <p className="text-xs text-muted-foreground">
            Used to identify this field in the database
          </p>
        </div>

        {/* Placeholder */}
        {!['radio', 'checkbox'].includes(field.field_type) && (
          <div className="space-y-2">
            <Label htmlFor="field-placeholder">Placeholder</Label>
            <Input
              id="field-placeholder"
              value={field.placeholder || ''}
              onChange={(e) => onUpdateField(field.id, { placeholder: e.target.value })}
              placeholder="Enter placeholder text"
            />
          </div>
        )}

        {/* Help Text */}
        <div className="space-y-2">
          <Label htmlFor="field-help">Help Text</Label>
          <Textarea
            id="field-help"
            value={field.help_text || ''}
            onChange={(e) => onUpdateField(field.id, { help_text: e.target.value })}
            placeholder="Additional instructions for this field"
            rows={2}
          />
        </div>

        {/* Required Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label>Required Field</Label>
            <p className="text-xs text-muted-foreground">
              User must fill this field
            </p>
          </div>
          <Switch
            checked={field.is_required}
            onCheckedChange={(checked) => 
              onUpdateField(field.id, { is_required: checked })
            }
          />
        </div>

        {/* Options Editor */}
        {hasOptions && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label>Options</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddOption}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Option
              </Button>
            </div>

            <div className="space-y-2">
              {(field.options || []).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option.label}
                    onChange={(e) =>
                      handleUpdateOption(index, { label: e.target.value })
                    }
                    placeholder="Label"
                  />
                  <Input
                    value={option.value}
                    onChange={(e) =>
                      handleUpdateOption(index, { value: e.target.value })
                    }
                    placeholder="Value"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOption(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        <Accordion type="single" collapsible className="pt-4 border-t">
          {/* Validation Rules */}
          <AccordionItem value="validation">
            <AccordionTrigger>Validation Rules</AccordionTrigger>
            <AccordionContent className="space-y-3">
              {['text', 'textarea'].includes(field.field_type) && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="min-length">Min Length</Label>
                      <Input
                        id="min-length"
                        type="number"
                        value={field.validation_rules?.minLength || ''}
                        onChange={(e) =>
                          onUpdateField(field.id, {
                            validation_rules: {
                              ...field.validation_rules,
                              minLength: e.target.value ? parseInt(e.target.value) : undefined,
                            },
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-length">Max Length</Label>
                      <Input
                        id="max-length"
                        type="number"
                        value={field.validation_rules?.maxLength || ''}
                        onChange={(e) =>
                          onUpdateField(field.id, {
                            validation_rules: {
                              ...field.validation_rules,
                              maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                            },
                          })
                        }
                        placeholder="100"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pattern">Pattern (Regex)</Label>
                    <Input
                      id="pattern"
                      value={field.validation_rules?.pattern || ''}
                      onChange={(e) =>
                        onUpdateField(field.id, {
                          validation_rules: {
                            ...field.validation_rules,
                            pattern: e.target.value,
                          },
                        })
                      }
                      placeholder="^[A-Za-z]+$"
                    />
                  </div>
                </>
              )}
              
              {field.field_type === 'number' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="min">Min Value</Label>
                    <Input
                      id="min"
                      type="number"
                      value={field.validation_rules?.min || ''}
                      onChange={(e) =>
                        onUpdateField(field.id, {
                          validation_rules: {
                            ...field.validation_rules,
                            min: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max">Max Value</Label>
                    <Input
                      id="max"
                      type="number"
                      value={field.validation_rules?.max || ''}
                      onChange={(e) =>
                        onUpdateField(field.id, {
                          validation_rules: {
                            ...field.validation_rules,
                            max: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      placeholder="100"
                    />
                  </div>
                </div>
              )}

              {field.field_type === 'file' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="file-types">Allowed File Types</Label>
                    <Input
                      id="file-types"
                      value={field.validation_rules?.fileTypes?.join(', ') || ''}
                      onChange={(e) =>
                        onUpdateField(field.id, {
                          validation_rules: {
                            ...field.validation_rules,
                            fileTypes: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                          },
                        })
                      }
                      placeholder="pdf, jpg, png"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-file-size">Max File Size (MB)</Label>
                    <Input
                      id="max-file-size"
                      type="number"
                      value={field.validation_rules?.maxFileSize || ''}
                      onChange={(e) =>
                        onUpdateField(field.id, {
                          validation_rules: {
                            ...field.validation_rules,
                            maxFileSize: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      placeholder="5"
                    />
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Conditional Logic */}
          <AccordionItem value="conditional">
            <AccordionTrigger>Conditional Logic</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Show this field only when another field meets certain conditions
              </p>
              <div className="space-y-2">
                <Label htmlFor="condition-field">Depends on Field</Label>
                <Input
                  id="condition-field"
                  value={field.conditional_logic?.show_if?.field_key || ''}
                  onChange={(e) =>
                    onUpdateField(field.id, {
                      conditional_logic: {
                        show_if: {
                          ...field.conditional_logic?.show_if,
                          field_key: e.target.value,
                          operator: field.conditional_logic?.show_if?.operator || 'equals',
                          value: field.conditional_logic?.show_if?.value || '',
                        },
                      },
                    })
                  }
                  placeholder="other_field_key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition-operator">Operator</Label>
                <Select
                  value={field.conditional_logic?.show_if?.operator || 'equals'}
                  onValueChange={(value: any) =>
                    onUpdateField(field.id, {
                      conditional_logic: {
                        show_if: {
                          ...field.conditional_logic?.show_if,
                          field_key: field.conditional_logic?.show_if?.field_key || '',
                          operator: value,
                          value: field.conditional_logic?.show_if?.value || '',
                        },
                      },
                    })
                  }
                >
                  <SelectTrigger id="condition-operator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="not_equals">Not Equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="greater_than">Greater Than</SelectItem>
                    <SelectItem value="less_than">Less Than</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition-value">Value</Label>
                <Input
                  id="condition-value"
                  value={field.conditional_logic?.show_if?.value || ''}
                  onChange={(e) =>
                    onUpdateField(field.id, {
                      conditional_logic: {
                        show_if: {
                          ...field.conditional_logic?.show_if,
                          field_key: field.conditional_logic?.show_if?.field_key || '',
                          operator: field.conditional_logic?.show_if?.operator || 'equals',
                          value: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="expected_value"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
