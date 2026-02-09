import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MessageSquarePlus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConversationSummary {
  client_id: string;
  staff_id: string;
  client_name: string;
  last_message_body: string;
  last_message_at: string;
  last_sender_type: 'client' | 'staff';
  unread_count: number;
}

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedClientId: string | null;
  onSelectConversation: (clientId: string) => void;
  onNewMessage: () => void;
  isLoading: boolean;
}

export function ConversationList({
  conversations,
  selectedClientId,
  onSelectConversation,
  onNewMessage,
  isLoading,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Messages</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Messages</h2>
        <Button variant="ghost" size="icon" onClick={onNewMessage} title="New message">
          <MessageSquarePlus className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <p className="text-sm">No conversations yet</p>
            <Button variant="link" onClick={onNewMessage} className="mt-2">
              Start a new conversation
            </Button>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.client_id}
              onClick={() => onSelectConversation(conv.client_id)}
              className={cn(
                'w-full text-left p-4 border-b border-border hover:bg-accent/50 transition-colors',
                selectedClientId === conv.client_id && 'bg-accent'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-foreground truncate">
                      {conv.client_name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.last_sender_type === 'staff' ? 'You: ' : ''}
                      {conv.last_message_body}
                    </p>
                    {conv.unread_count > 0 && (
                      <Badge variant="default" className="shrink-0 h-5 min-w-[20px] flex items-center justify-center text-xs rounded-full">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
