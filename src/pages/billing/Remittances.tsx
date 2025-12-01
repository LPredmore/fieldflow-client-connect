import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Remittances = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Remittances</h1>
          <p className="text-muted-foreground">
            View and process insurance remittance advice
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Remittance processing functionality is under development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            This feature will allow you to view ERA (Electronic Remittance Advice) and post payments automatically.
          </p>
          <Button onClick={() => navigate('/billing/eligibility')}>
            Go to Eligibility Check
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Remittances;
