import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Claims = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <FileCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Claims Management</h1>
          <p className="text-muted-foreground">
            Submit and track insurance claims
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Claims management functionality is under development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            This feature will allow you to submit CMS-1500 claims, track claim status, and manage rejections.
          </p>
          <Button onClick={() => navigate('/billing/eligibility')}>
            Go to Eligibility Check
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Claims;
