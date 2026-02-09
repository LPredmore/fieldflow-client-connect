import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  tenant_id: string;
  client_id: string;
  staff_id: string;
  sender_type: 'client' | 'staff';
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

interface ConversationSummary {
  client_id: string;
  staff_id: string;
  client_name: string;
  last_message_body: string;
  last_message_at: string;
  last_sender_type: 'client' | 'staff';
  unread_count: number;
}

// Fetch conversations for a staff member
export function useConversations() {
  const { user, tenantId } = useAuth();
  const staffId = user?.staffAttributes?.staffData?.id;

  return useQuery({
    queryKey: ['conversations', staffId],
    queryFn: async (): Promise<ConversationSummary[]> => {
      if (!staffId || !tenantId) return [];

      // Get all messages for this staff member, joined with client names
      const { data, error } = await supabase
        .from('messages' as any)
        .select('id, client_id, staff_id, sender_type, sender_id, body, read_at, created_at')
        .eq('staff_id', staffId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Group by client_id to build conversation summaries
      const conversationMap = new Map<string, {
        client_id: string;
        staff_id: string;
        last_message_body: string;
        last_message_at: string;
        last_sender_type: 'client' | 'staff';
        unread_count: number;
      }>();

      for (const msg of data as any[]) {
        if (!conversationMap.has(msg.client_id)) {
          conversationMap.set(msg.client_id, {
            client_id: msg.client_id,
            staff_id: msg.staff_id,
            last_message_body: msg.body,
            last_message_at: msg.created_at,
            last_sender_type: msg.sender_type,
            unread_count: 0,
          });
        }
        // Count unread messages from clients
        if (msg.sender_type === 'client' && !msg.read_at) {
          const conv = conversationMap.get(msg.client_id)!;
          conv.unread_count++;
        }
      }

      // Fetch client names
      const clientIds = Array.from(conversationMap.keys());
      const { data: clients } = await supabase
        .from('clients')
        .select('id, pat_name_f, pat_name_l, pat_name_preferred')
        .in('id', clientIds);

      const clientNameMap = new Map<string, string>();
      for (const c of clients || []) {
        const name = c.pat_name_preferred || 
          [c.pat_name_f, c.pat_name_l].filter(Boolean).join(' ') || 
          'Unknown Client';
        clientNameMap.set(c.id, name);
      }

      return Array.from(conversationMap.values())
        .map(conv => ({
          ...conv,
          client_name: clientNameMap.get(conv.client_id) || 'Unknown Client',
        }))
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    },
    enabled: !!staffId && !!tenantId,
    refetchInterval: 30000, // Fallback polling every 30s
  });
}

// Fetch messages for a specific thread
export function useThreadMessages(clientId: string | null) {
  const { user, tenantId } = useAuth();
  const staffId = user?.staffAttributes?.staffData?.id;

  return useQuery({
    queryKey: ['messages', clientId, staffId],
    queryFn: async (): Promise<Message[]> => {
      if (!clientId || !staffId) return [];

      const { data, error } = await supabase
        .from('messages' as any)
        .select('*')
        .eq('client_id', clientId)
        .eq('staff_id', staffId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as any as Message[];
    },
    enabled: !!clientId && !!staffId,
  });
}

// Send a message
export function useSendMessage() {
  const { user, tenantId } = useAuth();
  const queryClient = useQueryClient();
  const staffId = user?.staffAttributes?.staffData?.id;

  return useMutation({
    mutationFn: async ({ clientId, body }: { clientId: string; body: string }) => {
      if (!staffId || !tenantId || !user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('messages' as any)
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          staff_id: staffId,
          sender_type: 'staff',
          sender_id: user.id,
          body,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.clientId, staffId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', staffId] });
    },
  });
}

// Mark messages as read
export function useMarkAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const staffId = user?.staffAttributes?.staffData?.id;

  return useMutation({
    mutationFn: async (clientId: string) => {
      if (!staffId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('messages' as any)
        .update({ read_at: new Date().toISOString() } as any)
        .eq('client_id', clientId)
        .eq('staff_id', staffId)
        .eq('sender_type', 'client')
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ['messages', clientId, staffId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', staffId] });
      queryClient.invalidateQueries({ queryKey: ['unread-count', staffId] });
    },
  });
}

// Unread count for nav badge
export function useUnreadCount() {
  const { user, tenantId } = useAuth();
  const staffId = user?.staffAttributes?.staffData?.id;

  return useQuery({
    queryKey: ['unread-count', staffId],
    queryFn: async (): Promise<number> => {
      if (!staffId || !tenantId) return 0;

      const { count, error } = await supabase
        .from('messages' as any)
        .select('*', { count: 'exact', head: true })
        .eq('staff_id', staffId)
        .eq('sender_type', 'client')
        .is('read_at', null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!staffId && !!tenantId,
    refetchInterval: 30000,
  });
}

// Realtime subscription hook
export function useMessagesRealtime(clientId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const staffId = user?.staffAttributes?.staffData?.id;

  useEffect(() => {
    if (!staffId) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `staff_id=eq.${staffId}`,
        },
        (payload) => {
          // Invalidate relevant queries
          const newMsg = payload.new as any;
          queryClient.invalidateQueries({ queryKey: ['messages', newMsg.client_id, staffId] });
          queryClient.invalidateQueries({ queryKey: ['conversations', staffId] });
          queryClient.invalidateQueries({ queryKey: ['unread-count', staffId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, queryClient]);
}
