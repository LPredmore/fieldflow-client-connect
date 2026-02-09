import { useState, useEffect } from 'react';
import { ConversationList } from '@/components/Messages/ConversationList';
import { MessageThread } from '@/components/Messages/MessageThread';
import { NewMessageDialog } from '@/components/Messages/NewMessageDialog';
import {
  useConversations,
  useThreadMessages,
  useSendMessage,
  useMarkAsRead,
  useMessagesRealtime,
} from '@/hooks/useMessages';
import { MessageSquare } from 'lucide-react';

export default function Messages() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);

  const { data: conversations = [], isLoading: convsLoading } = useConversations();
  const { data: messages = [], isLoading: msgsLoading } = useThreadMessages(selectedClientId);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();

  // Wire up realtime
  useMessagesRealtime(selectedClientId);

  // Get selected client name
  const selectedConv = conversations.find(c => c.client_id === selectedClientId);
  const clientName = selectedConv?.client_name || 'Unknown Client';

  // Mark messages as read when viewing a thread
  useEffect(() => {
    if (selectedClientId && selectedConv && selectedConv.unread_count > 0) {
      markAsRead.mutate(selectedClientId);
    }
  }, [selectedClientId, selectedConv?.unread_count]);

  const handleSend = (body: string) => {
    if (!selectedClientId) return;
    sendMessage.mutate({ clientId: selectedClientId, body });
  };

  const handleNewMessageSend = (clientId: string, body: string) => {
    sendMessage.mutate({ clientId, body }, {
      onSuccess: () => setSelectedClientId(clientId),
    });
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] border border-border rounded-lg overflow-hidden bg-background">
      {/* Conversation List */}
      <div className="w-80 border-r border-border shrink-0 hidden md:flex flex-col">
        <ConversationList
          conversations={conversations}
          selectedClientId={selectedClientId}
          onSelectConversation={setSelectedClientId}
          onNewMessage={() => setShowNewMessage(true)}
          isLoading={convsLoading}
        />
      </div>

      {/* Message Thread or Empty State */}
      <div className="flex-1 flex flex-col">
        {selectedClientId ? (
          <MessageThread
            messages={messages}
            clientName={clientName}
            onSend={handleSend}
            isSending={sendMessage.isPending}
            isLoading={msgsLoading}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="h-12 w-12" />
            <p className="text-sm">Select a conversation or start a new one</p>
          </div>
        )}
      </div>

      {/* Mobile conversation list - shown when no thread selected */}
      {!selectedClientId && (
        <div className="absolute inset-0 md:hidden">
          <ConversationList
            conversations={conversations}
            selectedClientId={selectedClientId}
            onSelectConversation={setSelectedClientId}
            onNewMessage={() => setShowNewMessage(true)}
            isLoading={convsLoading}
          />
        </div>
      )}

      <NewMessageDialog
        open={showNewMessage}
        onOpenChange={setShowNewMessage}
        onSend={handleNewMessageSend}
        isSending={sendMessage.isPending}
      />
    </div>
  );
}
