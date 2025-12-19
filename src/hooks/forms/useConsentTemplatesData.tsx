import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ConsentTemplate, ConsentContent } from '@/components/Forms/types';

interface UseConsentTemplatesDataReturn {
  templates: ConsentTemplate[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTemplate: (data: Partial<ConsentTemplate>) => Promise<ConsentTemplate | null>;
  updateTemplate: (id: string, data: Partial<ConsentTemplate>) => Promise<ConsentTemplate | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
  customizeSystemDefault: (systemTemplateId: string) => Promise<ConsentTemplate | null>;
}

export function useConsentTemplatesData(): UseConsentTemplatesDataReturn {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!tenantId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch both system defaults (tenant_id IS NULL) and tenant-specific templates
      const { data, error: fetchError } = await supabase
        .from('consent_templates')
        .select('*')
        .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
        .order('consent_type', { ascending: true })
        .order('version', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      // Transform data to proper types
      const transformedData: ConsentTemplate[] = (data || []).map(item => ({
        id: item.id,
        tenant_id: item.tenant_id,
        consent_type: item.consent_type,
        title: item.title,
        content: item.content as ConsentContent,
        version: item.version,
        is_active: item.is_active,
        is_system_default: item.tenant_id === null,
        created_by_profile_id: item.created_by_profile_id,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
      
      setTemplates(transformedData);
    } catch (err: any) {
      console.error('Error fetching consent templates:', err);
      setError(err.message || 'Failed to load consent templates');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load consent templates',
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(async (
    data: Partial<ConsentTemplate>
  ): Promise<ConsentTemplate | null> => {
    if (!tenantId || !user) return null;
    
    try {
      const { data: created, error: createError } = await supabase
        .from('consent_templates')
        .insert({
          tenant_id: tenantId,
          consent_type: data.consent_type || 'custom',
          title: data.title || 'Untitled Consent Form',
          content: data.content || { sections: [] },
          version: 1,
          is_active: data.is_active ?? false,
          created_by_profile_id: user.id,
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      toast({
        title: 'Success',
        description: 'Consent template created successfully',
      });
      
      await fetchTemplates();
      return created as ConsentTemplate;
    } catch (err: any) {
      console.error('Error creating consent template:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create consent template',
      });
      return null;
    }
  }, [tenantId, user, toast, fetchTemplates]);

  const updateTemplate = useCallback(async (
    id: string,
    data: Partial<ConsentTemplate>
  ): Promise<ConsentTemplate | null> => {
    try {
      const { data: updated, error: updateError } = await supabase
        .from('consent_templates')
        .update({
          title: data.title,
          content: data.content,
          is_active: data.is_active,
          version: data.version,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      toast({
        title: 'Success',
        description: 'Consent template updated successfully',
      });
      
      await fetchTemplates();
      return updated as ConsentTemplate;
    } catch (err: any) {
      console.error('Error updating consent template:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update consent template',
      });
      return null;
    }
  }, [toast, fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('consent_templates')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      toast({
        title: 'Success',
        description: 'Consent template deleted successfully',
      });
      
      await fetchTemplates();
      return true;
    } catch (err: any) {
      console.error('Error deleting consent template:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete consent template',
      });
      return false;
    }
  }, [toast, fetchTemplates]);

  const customizeSystemDefault = useCallback(async (
    systemTemplateId: string
  ): Promise<ConsentTemplate | null> => {
    if (!tenantId || !user) return null;
    
    try {
      // Find the system template
      const systemTemplate = templates.find(t => t.id === systemTemplateId && t.is_system_default);
      if (!systemTemplate) {
        throw new Error('System template not found');
      }
      
      // Create a tenant-specific copy
      const { data: created, error: createError } = await supabase
        .from('consent_templates')
        .insert({
          tenant_id: tenantId,
          consent_type: systemTemplate.consent_type,
          title: systemTemplate.title,
          content: systemTemplate.content,
          version: 1,
          is_active: false,
          created_by_profile_id: user.id,
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      toast({
        title: 'Success',
        description: 'Created customizable copy of system template',
      });
      
      await fetchTemplates();
      return created as ConsentTemplate;
    } catch (err: any) {
      console.error('Error customizing system template:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to customize system template',
      });
      return null;
    }
  }, [tenantId, user, templates, toast, fetchTemplates]);

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    customizeSystemDefault,
  };
}
