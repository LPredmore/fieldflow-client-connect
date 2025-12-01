import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClientStatus } from '@/hooks/useClientStatus';
import { toast } from '@/hooks/use-toast';

interface SignupForm {
  id: string;
  form_template_id: string;
  due_date: string | null;
  completed_at: string | null;
  status: string;
  form_template: {
    name: string;
    description: string | null;
  };
}

interface SignupFormsListProps {
  forms: SignupForm[];
  loading: boolean;
}

export function SignupFormsList({ forms, loading }: SignupFormsListProps) {
  const navigate = useNavigate();
  const { updateStatus, customerId } = useClientStatus();

  const completedCount = forms.filter(f => f.completed_at).length;
  const totalCount = forms.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allCompleted = completedCount === totalCount && totalCount > 0;

  const handleCompleteSignup = async () => {
    if (!allCompleted) {
      toast({
        title: "Forms Incomplete",
        description: "Please complete all required forms before finishing signup.",
        variant: "destructive",
      });
      return;
    }

    const success = await updateStatus('registered');
    if (success) {
      toast({
        title: "Signup Complete!",
        description: "Welcome! You now have full access to your portal.",
      });
      navigate('/client/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Signup Forms Required</CardTitle>
          <CardDescription>
            You're all set! Click below to complete your registration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCompleteSignup} size="lg" className="w-full">
            Complete Sign-Up
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Complete Your Registration</CardTitle>
          <CardDescription>
            Please complete the following forms to finish your signup process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{completedCount} of {totalCount} completed</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {allCompleted && (
            <Button onClick={handleCompleteSignup} size="lg" className="w-full">
              Complete Sign-Up
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {forms.map((form) => {
          const isCompleted = !!form.completed_at;
          
          return (
            <Card key={form.id} className={isCompleted ? 'border-green-500/50' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-1" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground mt-1" />
                    )}
                    <div>
                      <CardTitle className="text-lg">{form.form_template.name}</CardTitle>
                      {form.form_template.description && (
                        <CardDescription className="mt-1">
                          {form.form_template.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge variant={isCompleted ? 'default' : 'secondary'}>
                    {isCompleted ? 'Completed' : 'Pending'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate(`/client/complete-form/${form.id}`)}
                  variant={isCompleted ? 'outline' : 'default'}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {isCompleted ? 'View Form' : 'Complete Form'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
