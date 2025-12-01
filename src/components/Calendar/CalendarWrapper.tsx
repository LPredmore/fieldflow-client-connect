import { lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon } from 'lucide-react';

// Lazy load the React Big Calendar component to reduce initial bundle size
const RBCCalendar = lazy(() => import('./RBCCalendar').then(module => ({
  default: module.RBCCalendar
})));

// Loading fallback component
const CalendarLoadingFallback = () => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <CalendarIcon className="h-5 w-5" />
        Loading Calendar...
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="animate-pulse space-y-4">
        <div className="h-96 bg-muted rounded-lg"></div>
      </div>
    </CardContent>
  </Card>
);

export function CalendarWrapper() {
  return (
    <Suspense fallback={<CalendarLoadingFallback />}>
      <RBCCalendar />
    </Suspense>
  );
}