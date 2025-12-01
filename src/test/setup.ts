import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({
              data: [
                { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
                { column_name: 'title', data_type: 'text', is_nullable: 'YES', column_default: null },
                { column_name: 'description', data_type: 'text', is_nullable: 'YES', column_default: null },
                { column_name: 'service_id', data_type: 'uuid', is_nullable: 'YES', column_default: null },
                { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
              ],
              error: null,
            })),
          })),
          single: vi.fn(),
          order: vi.fn(),
        })),
        order: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      })),
    })),
  },
}));

// Mock auth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    tenantId: 'test-tenant-id',
  }),
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));