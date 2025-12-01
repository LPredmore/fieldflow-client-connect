import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAssignedForms } from '@/hooks/useAssignedForms';
import { Calendar, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { format, isPast } from 'date-fns';

interface FormsTabProps {
  customerId: string;
}

export function FormsTab({ customerId }: FormsTabProps) {
  const navigate = useNavigate();
  const { pendingForms, completedForms, loading } = useAssignedForms(customerId);

  const handleCompleteForm = (assignmentId: string) => {
    navigate(`/client/complete-form/${assignmentId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Your Forms</h2>
        <p className="text-muted-foreground mt-1">
          Complete assigned forms and view your submissions
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            Pending
            {pendingForms.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingForms.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedForms.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingForms.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
                <p className="text-muted-foreground text-center">
                  You don't have any pending forms to complete.
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingForms.map((assignment) => {
              const isOverdue =
                assignment.due_date && isPast(new Date(assignment.due_date));

              return (
                <Card key={assignment.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          {assignment.form_template.name}
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                        </CardTitle>
                        {assignment.form_template.description && (
                          <CardDescription>
                            {assignment.form_template.description}
                          </CardDescription>
                        )}
                      </div>
                      <Button onClick={() => handleCompleteForm(assignment.id)}>
                        Complete Form
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                      {assignment.due_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Due: {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                          </span>
                          {isOverdue && (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      )}
                      {assignment.notes && (
                        <div className="flex items-start gap-2 mt-2">
                          <FileText className="h-4 w-4 mt-0.5" />
                          <span>{assignment.notes}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedForms.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No completed forms</h3>
                <p className="text-muted-foreground text-center">
                  Forms you complete will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            completedForms.map((assignment) => (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {assignment.form_template.name}
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      </CardTitle>
                      {assignment.form_template.description && (
                        <CardDescription>
                          {assignment.form_template.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Completed:{' '}
                      {assignment.completed_at
                        ? format(new Date(assignment.completed_at), 'MMM d, yyyy h:mm a')
                        : '-'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
