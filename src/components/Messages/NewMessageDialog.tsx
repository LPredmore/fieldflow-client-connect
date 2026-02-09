import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ClientSelector } from '@/components/Clients/ClientSelector';
import { Label } from '@/components/ui/label';

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (clientId: string, body: string) => void;
  isSending: boolean;
}

export function NewMessageDialog({ open, onOpenChange, onSend, isSending }: NewMessageDialogProps) {
  const [clientId, setClientId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [body, setBody] = useState('');

  const handleSend = () => {
    if (!clientId || !body.trim()) return;
    onSend(clientId, body.trim());
    setClientId('');
    setClientName('');
    setBody('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Start a new conversation with a client.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <ClientSelector
              value={clientId}
              onValueChange={(id, name) => {
                setClientId(id);
                setClientName(name);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message..."
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={!clientId || !body.trim() || isSending}>
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
