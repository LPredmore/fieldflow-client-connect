
# Direct Deposit Section Implementation Plan

## Overview

Add a new "Direct Deposit" collapsible card section to the Profile page (`/staff/profile`) that allows staff members to enter their bank account information for payroll purposes. This section will be placed between "Client Facing Information" and "Password & Security".

## Database Schema (Already Exists)

The `payroll_recipients` table already exists with the following relevant columns:

| Column | Type | Usage |
|--------|------|-------|
| `id` | uuid | Primary key |
| `tenant_id` | uuid | Required, from auth context |
| `staff_id` | uuid | Required, links to `staff.id` |
| `recipient_name` | text | Legal name on bank account |
| `deposit_addr_1` | text | Street address |
| `deposit_addr_2` | text | Apt/Suite/Unit |
| `deposit_city` | text | City |
| `deposit_state` | state_code_enum | State dropdown |
| `deposit_zip` | text | ZIP code |
| `routing_number_encrypted` | text | Will store raw routing number |
| `account_number_encrypted` | text | Will store raw account number |
| `routing_number_last4` | text | Last 4 digits for display |
| `account_number_last4` | text | Last 4 digits for display |
| `account_type` | text | personalChecking/personalSavings/businessChecking/businessSavings |
| `is_active` | boolean | Default true |

**Note**: Per user decision, raw values will be stored in the `_encrypted` columns for now; the billing portal will handle actual encryption later.

## Implementation Steps

### Step 1: Add RLS Policy for payroll_recipients

Currently RLS is disabled on this table. We need to enable it and add a policy allowing staff to manage their own records.

```sql
-- Enable RLS
ALTER TABLE payroll_recipients ENABLE ROW LEVEL SECURITY;

-- Staff can view/manage their own payroll recipient record
CREATE POLICY "Staff can manage own payroll recipient"
ON payroll_recipients FOR ALL
USING (
  staff_id IN (
    SELECT id FROM staff WHERE profile_id = auth.uid()
  )
)
WITH CHECK (
  staff_id IN (
    SELECT id FROM staff WHERE profile_id = auth.uid()
  )
);

-- Admins can view all tenant payroll recipients (for billing portal)
CREATE POLICY "Admins can view tenant payroll recipients"
ON payroll_recipients FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_memberships 
    WHERE profile_id = auth.uid()
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);
```

### Step 2: Create usePayrollRecipient Hook

Create a new hook at `src/hooks/usePayrollRecipient.tsx` that:
- Fetches the current staff member's payroll recipient record (if exists)
- Provides upsert functionality (insert if not exists, update if exists)
- Uses `useSupabaseQuery` for fetching and custom upsert logic

```typescript
// Key interface
interface PayrollRecipient {
  id: string;
  tenant_id: string;
  staff_id: string;
  recipient_name: string | null;
  deposit_addr_1: string | null;
  deposit_addr_2: string | null;
  deposit_city: string | null;
  deposit_state: string | null;
  deposit_zip: string | null;
  routing_number_encrypted: string | null;  // Stores raw value temporarily
  account_number_encrypted: string | null;  // Stores raw value temporarily
  routing_number_last4: string | null;
  account_number_last4: string | null;
  account_type: string;
  is_active: boolean;
}

// Form data interface (what user inputs)
interface PayrollFormData {
  recipient_name: string;
  deposit_addr_1: string;
  deposit_addr_2: string;
  deposit_city: string;
  deposit_state: string;
  deposit_zip: string;
  routing_number: string;    // Full 9 digits
  account_number: string;    // Full account number
  account_type: string;
}
```

### Step 3: Update Profile.tsx

Add a new card section between "Client Facing Information" and "Password & Security":

1. **Add state for Direct Deposit form**:
```typescript
const [directDeposit, setDirectDeposit] = useState({
  recipient_name: '',
  deposit_addr_1: '',
  deposit_addr_2: '',
  deposit_city: '',
  deposit_state: '',
  deposit_zip: '',
  routing_number: '',
  account_number: '',
  account_type: '',
});
```

2. **Add usePayrollRecipient hook call**:
```typescript
const { 
  payrollRecipient, 
  loading: payrollLoading, 
  upsertPayrollRecipient 
} = usePayrollRecipient(staff?.id);
```

3. **Add useEffect to sync form state from loaded data**:
```typescript
useEffect(() => {
  if (payrollRecipient) {
    setDirectDeposit({
      recipient_name: payrollRecipient.recipient_name || '',
      deposit_addr_1: payrollRecipient.deposit_addr_1 || '',
      // ... etc (routing/account numbers are masked for display)
    });
  }
}, [payrollRecipient]);
```

4. **Add form submission handler with validation**:
```typescript
const handleDirectDepositSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validation
  if (directDeposit.routing_number && directDeposit.routing_number.length !== 9) {
    toast({ variant: "destructive", title: "Invalid routing number", description: "Routing number must be exactly 9 digits" });
    return;
  }
  
  // Submit
  await upsertPayrollRecipient({
    ...directDeposit,
    // Extract last4 for display
    routing_number_last4: directDeposit.routing_number.slice(-4),
    account_number_last4: directDeposit.account_number.slice(-4),
  });
};
```

5. **Add the Direct Deposit card UI**:

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🏦 Direct Deposit                                               │
│ Enter your bank account information for payroll                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Recipient Name*          [________________________]             │
│ (Legal name on account)                                         │
│                                                                 │
│ Street Address*          [________________________]             │
│ Address Line 2           [________________________]             │
│                                                                 │
│ City*         State*          ZIP Code*                         │
│ [________]    [Dropdown ▼]    [________]                        │
│                                                                 │
│ ─────────────────────────────────────────────────────────────   │
│                                                                 │
│ Routing Number*          Account Number*                        │
│ [_________]              [________________]                     │
│ (9 digits)                                                      │
│                                                                 │
│ Account Type*                                                   │
│ [Select account type ▼]                                         │
│   - Personal Checking                                           │
│   - Personal Savings                                            │
│   - Business Checking                                           │
│   - Business Savings                                            │
│                                                                 │
│ [  Update Direct Deposit Information  ]                         │
└─────────────────────────────────────────────────────────────────┘
```

## UI/UX Details

### Form Fields

| Field | Type | Required | Validation | Help Text |
|-------|------|----------|------------|-----------|
| Recipient Name | Input | Yes | Non-empty | Legal name on bank account (person or business) |
| Street Address | Input | Yes | Non-empty | Address associated with the bank account |
| Address Line 2 | Input | No | - | Apartment / Suite / Unit |
| City | Input | Yes | Non-empty | - |
| State | Select | Yes | state_code_enum | Use existing US_STATES dropdown |
| ZIP Code | Input | Yes | Non-empty | - |
| Routing Number | Input | Yes | Exactly 9 digits, numbers only | Must be exactly 9 digits |
| Account Number | Input | Yes | Non-empty, numbers only | - |
| Account Type | Select | Yes | One of 4 options | - |

### Account Type Options

```typescript
const ACCOUNT_TYPE_OPTIONS = [
  { value: 'personalChecking', label: 'Personal Checking' },
  { value: 'personalSavings', label: 'Personal Savings' },
  { value: 'businessChecking', label: 'Business Checking' },
  { value: 'businessSavings', label: 'Business Savings' },
];
```

### Security Considerations

1. **Masking on load**: When displaying existing data, show only last 4 digits for routing/account numbers (e.g., "••••1234")
2. **Full entry on edit**: User must re-enter full routing/account numbers when updating
3. **Input type**: Use `type="text"` with `inputMode="numeric"` and `pattern="[0-9]*"` for number fields
4. **No autocomplete**: Add `autoComplete="off"` to sensitive fields

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx.sql` | CREATE | Enable RLS and add policies for payroll_recipients |
| `src/hooks/usePayrollRecipient.tsx` | CREATE | Hook for fetching/upserting payroll recipient data |
| `src/pages/Profile.tsx` | MODIFY | Add Direct Deposit section with form and state management |

## Technical Notes

1. **Upsert Logic**: Since a staff member can only have one payroll recipient record, use Supabase's `.upsert()` with `onConflict: 'staff_id'` or manually check for existing record

2. **Regenerate Types**: After the migration runs, the Supabase types file will be regenerated to include `payroll_recipients`

3. **Icon**: Use `Banknote` from lucide-react for the section icon (consistent with financial theming)

4. **Conditional Rendering**: Only show the Direct Deposit section when `staff` exists (same pattern as other staff-only sections)

5. **Loading State**: Show skeleton or loading indicator while payroll data is being fetched

## Error Handling

- Display toast notifications for:
  - Validation errors (routing number not 9 digits)
  - Database errors (RLS violation, connection issues)
  - Success messages ("Direct deposit information updated successfully")
