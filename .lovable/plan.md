

# Update Browser Tab Title to Show Tenant Name

## What's Changing

The browser tab currently shows the hardcoded text "FieldFlow - Field Service Management Platform" (set in `index.html`). It should instead show the tenant's name from the database (e.g., "ValorWell").

## Approach

The `useTenantBranding` hook already fetches `display_name` from the `tenants` table. We just need to add a `useEffect` in that same hook to update `document.title` when the tenant name is available -- the same pattern already used there for the favicon.

## Changes

| File | Change |
|---|---|
| `index.html` | Update the default `<title>` to something generic like "Loading..." so it doesn't flash "FieldFlow" before the tenant name loads |
| `src/hooks/useTenantBranding.tsx` | Add a `useEffect` that sets `document.title` to the tenant's `display_name`, reverting to a default on unmount |

## How It Works

1. Page loads with a neutral default title
2. User authenticates, `useTenantBranding` fetches tenant data
3. The new `useEffect` sets `document.title` to the tenant's `display_name`
4. If the hook unmounts or no name is available, it falls back to a generic default

No database changes. No new files. Just two small edits.

