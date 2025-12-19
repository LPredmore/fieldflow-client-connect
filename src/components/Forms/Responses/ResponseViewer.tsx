import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FormTemplate } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, Download, Loader2, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ResponseDetailDialog } from './ResponseDetailDialog';

interface FormResponse {
  id: string;
  form_template_id: string;
  customer_id: string;
  submitted_by_user_id: string | null;
  response_data: Record<string, any>;
  submitted_at: string;
  customer: {
    pat_name_f: string | null;
    pat_name_l: string | null;
    pat_name_m: string | null;
    preferred_name: string | null;
    email: string | null;
    full_name?: string;
  };
}

interface ResponseViewerProps {
  template: FormTemplate;
  onClose: () => void;
}

export function ResponseViewer({ template, onClose }: ResponseViewerProps) {
  const { toast } = useToast();
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);

  useEffect(() => {
    fetchResponses();
  }, [template.id]);

  const fetchResponses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('form_responses')
        .select(`
          *,
          customer:clients (
            pat_name_f,
            pat_name_l,
            pat_name_m,
            preferred_name,
            email
          )
        `)
        .eq('form_template_id', template.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      
      // Transform responses to add computed full_name
      const transformedData = (data || []).map(response => ({
        ...response,
        customer: response.customer ? {
          ...response.customer,
          full_name: [
            response.customer.pat_name_f,
            response.customer.pat_name_m,
            response.customer.pat_name_l
          ].filter(Boolean).join(' ').trim() || response.customer.preferred_name || 'Unknown'
        } : null
      }));
      
      setResponses(transformedData);
    } catch (error: any) {
      console.error('Error fetching responses:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load form responses',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredResponses = responses.filter((response) =>
    response.customer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = (response: FormResponse) => {
    // Create a formatted text version
    const text = JSON.stringify(response.response_data, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${response.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'Response exported successfully',
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Form Responses: {template.name}</CardTitle>
              <CardDescription>
                {filteredResponses.length} {filteredResponses.length === 1 ? 'response' : 'responses'}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? 'No responses found matching your search.' : 'No responses submitted yet.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResponses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell className="font-medium">
                      {response.customer?.full_name || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {response.customer?.email || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(response.submitted_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedResponse(response)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExport(response)}
                          title="Export response"
                        >
                          <Download className="h-4 w-4" />
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

      {/* Response Detail Dialog */}
      {selectedResponse && (
        <ResponseDetailDialog
          open={!!selectedResponse}
          onOpenChange={(open) => !open && setSelectedResponse(null)}
          response={selectedResponse}
          template={template}
        />
      )}
    </>
  );
}
