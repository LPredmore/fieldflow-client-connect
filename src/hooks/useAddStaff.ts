import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface AddStaffData {
  email: string;
  firstName: string;
  lastName: string;
  specialty?: string;
  roles: string[];
  tenantId: string;
}

interface AddStaffResult {
  success: boolean;
  userId?: string;
  staffId?: string;
  password?: string;
  error?: string;
  diagnostics?: DiagnosticTrace;
}

export interface DiagnosticTrace {
  diagnosticId: string;
  timestamp: string;
  input: {
    email: string;
    firstName: string;
    lastName: string;
    specialty?: string;
    roles: string[];
    tenantId: string;
  };
  response?: {
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
    errorName?: string;
    errorContext?: string;
  };
  timingMs: number;
  browserInfo: {
    userAgent: string;
    url: string;
  };
}

function generateDiagnosticId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `staff-${timestamp}-${random}`;
}

export function useAddStaff() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDiagnostics, setLastDiagnostics] = useState<DiagnosticTrace | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createStaff = async (data: AddStaffData): Promise<AddStaffResult> => {
    setLoading(true);
    setError(null);

    const diagnosticId = generateDiagnosticId();
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Initialize diagnostic trace
    const diagnostics: DiagnosticTrace = {
      diagnosticId,
      timestamp,
      input: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        specialty: data.specialty,
        roles: data.roles,
        tenantId: data.tenantId,
      },
      response: undefined,
      timingMs: 0,
      browserInfo: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      },
    };

    console.log(`[DIAG:${diagnosticId}] Starting staff creation`, {
      timestamp,
      input: diagnostics.input,
    });

    try {
      console.log(`[DIAG:${diagnosticId}] Invoking edge function create-staff-account`);
      
      const { data: response, error: fnError } = await supabase.functions.invoke(
        'create-staff-account',
        {
          body: {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            specialty: data.specialty,
            roles: data.roles,
            tenantId: data.tenantId,
            diagnosticId, // Pass to edge function for log correlation
          },
        }
      );

      const timingMs = Date.now() - startTime;
      diagnostics.timingMs = timingMs;

      console.log(`[DIAG:${diagnosticId}] Edge function response received`, {
        timingMs,
        hasError: !!fnError,
        hasResponse: !!response,
        responseKeys: response ? Object.keys(response) : [],
      });

      if (fnError) {
        const errorMessage = fnError.message || 'Failed to create staff account';
        console.error(`[DIAG:${diagnosticId}] Edge function error`, {
          errorName: fnError.name,
          errorMessage: fnError.message,
          errorContext: fnError.context,
        });

        diagnostics.response = {
          success: false,
          error: errorMessage,
          errorName: fnError.name,
          errorContext: typeof fnError.context === 'string' ? fnError.context : JSON.stringify(fnError.context),
        };

        setError(errorMessage);
        setLastDiagnostics(diagnostics);
        toast({
          title: 'Error',
          description: `${errorMessage} (Diagnostic ID: ${diagnosticId})`,
          variant: 'destructive',
        });
        return { success: false, error: errorMessage, diagnostics };
      }

      if (response?.error) {
        console.error(`[DIAG:${diagnosticId}] Response contains error`, {
          error: response.error,
        });

        diagnostics.response = {
          success: false,
          error: response.error,
          data: response,
        };

        setError(response.error);
        setLastDiagnostics(diagnostics);
        toast({
          title: 'Error',
          description: `${response.error} (Diagnostic ID: ${diagnosticId})`,
          variant: 'destructive',
        });
        return { success: false, error: response.error, diagnostics };
      }

      // Success case
      console.log(`[DIAG:${diagnosticId}] Staff creation successful`, {
        userId: response?.userId,
        staffId: response?.staffId,
        hasPassword: !!response?.password,
      });

      diagnostics.response = {
        success: true,
        data: {
          userId: response?.userId,
          staffId: response?.staffId,
          diagnosticId: response?.diagnosticId,
        },
      };

      setLastDiagnostics(diagnostics);

      // Invalidate relevant queries to refresh staff list
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });

      toast({
        title: 'Success',
        description: `Staff member created successfully. (ID: ${diagnosticId})`,
      });

      return {
        success: true,
        userId: response.userId,
        staffId: response.staffId,
        password: response.password,
        diagnostics,
      };
    } catch (err: unknown) {
      const timingMs = Date.now() - startTime;
      diagnostics.timingMs = timingMs;

      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      const errorName = err instanceof Error ? err.name : 'UnknownError';
      
      console.error(`[DIAG:${diagnosticId}] Unexpected exception`, {
        errorName,
        errorMessage,
        errorStack: err instanceof Error ? err.stack : undefined,
        timingMs,
      });

      diagnostics.response = {
        success: false,
        error: errorMessage,
        errorName,
      };

      setError(errorMessage);
      setLastDiagnostics(diagnostics);
      toast({
        title: 'Error',
        description: `${errorMessage} (Diagnostic ID: ${diagnosticId})`,
        variant: 'destructive',
      });
      return { success: false, error: errorMessage, diagnostics };
    } finally {
      setLoading(false);
    }
  };

  return {
    createStaff,
    loading,
    error,
    lastDiagnostics,
  };
}
