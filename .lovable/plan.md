

# Implementation Plan: Dynamic Tenant Logo as Favicon

## Problem Summary

The favicon is currently a static `favicon.ico` file in the `public/` directory with no `<link rel="icon">` tag in `index.html`. The tenant logo is already being fetched via `useTenantBranding()` and displayed in the navigation sidebar. The goal is to dynamically set the browser favicon to match the tenant's logo.

---

## Database Reality

```text
Tenant: ValorWell
Logo URL: https://ahqauomkgflopxgnlndd.supabase.co/storage/v1/object/public/org-logos/00000000-0000-0000-0000-000000000001/logo.png
```

The logo is stored in Supabase Storage with a public URL, making it directly accessible for favicon use.

---

## Technical Decision

**Extend the `useTenantBranding` hook to include a `useEffect` that dynamically updates the document's favicon whenever the tenant logo URL changes.**

### Why This Is the Right Approach

1. **Single Source of Truth**: The `useTenantBranding` hook already owns the tenant logo data. Adding favicon logic here keeps branding concerns consolidated in one place.

2. **Already Used in Protected Routes**: The Navigation component (which is only rendered after authentication) already calls `useTenantBranding`. The favicon update will naturally occur at the right time - after the user is authenticated and their tenant is known.

3. **No Additional Network Requests**: The logo URL is already being fetched for the navigation. We're simply reusing that same URL for the favicon.

4. **Graceful Fallback**: If no logo URL exists, we leave the favicon unchanged (falls back to the static `favicon.ico`).

5. **Standard Web API**: Uses the standard `document.querySelector('link[rel="icon"]')` approach which is well-supported across all browsers.

### Alternative Considered (Rejected)

**Creating a separate component/hook for favicon management**: This would fragment branding logic across multiple files. Since `useTenantBranding` already exists specifically for tenant branding concerns, extending it is more cohesive.

---

## Implementation Details

### 1. Modify `useTenantBranding.tsx`

**File: `src/hooks/useTenantBranding.tsx`**

Add a `useEffect` that updates the favicon when `logoUrl` changes.

```text
Changes:
1. Import useEffect from React
2. Add useEffect that:
   - Finds or creates the <link rel="icon"> element
   - Sets href to logoUrl when available
   - Falls back to default '/favicon.ico' when no logo exists
   - Cleans up on unmount (restores default favicon)
```

```typescript
// New code to add
useEffect(() => {
  if (!logoUrl) return;
  
  // Find existing favicon link or create one
  let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  
  if (!faviconLink) {
    faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    document.head.appendChild(faviconLink);
  }
  
  // Store original favicon for cleanup
  const originalHref = faviconLink.href;
  
  // Update favicon to tenant logo
  faviconLink.href = logoUrl;
  
  // Cleanup: restore original favicon when component unmounts
  return () => {
    if (faviconLink) {
      faviconLink.href = originalHref || '/favicon.ico';
    }
  };
}, [logoUrl]);
```

### 2. Add Default Favicon Link to `index.html`

**File: `index.html`**

Add a `<link rel="icon">` tag so there's a guaranteed element to update. Currently there's no favicon link in the HTML.

```html
<!-- Add in <head> section -->
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useTenantBranding.tsx` | **Modify** | Add useEffect to dynamically set favicon from logoUrl |
| `index.html` | **Modify** | Add default favicon link tag |

---

## Data Flow After Implementation

```text
User logs in → Auth succeeds
         │
         ▼
UnifiedRoutingGuard routes to /staff/*
         │
         ▼
Navigation component renders
         │
         ▼
useTenantBranding() called
  → Fetches tenant: { logo_url: "https://...logo.png" }
         │
         ▼
useEffect in useTenantBranding fires
  → document.querySelector('link[rel="icon"]')
  → Sets href = logoUrl
         │
         ▼
Browser updates tab favicon to tenant logo
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No logo_url set for tenant | Favicon remains as default `/favicon.ico` |
| Logo URL fails to load | Browser shows broken icon (acceptable - matches navigation behavior) |
| User logs out | Cleanup function restores default favicon |
| Multiple tenants (future) | Each tenant switch triggers new logoUrl, favicon updates accordingly |
| Logo is not square | Browser handles scaling (may appear distorted - same as any favicon) |

---

## Browser Compatibility

The `document.querySelector` and dynamic link manipulation is supported in all modern browsers:
- Chrome, Firefox, Safari, Edge: Full support
- IE11: Supported (not relevant for this app)

---

## What This Does NOT Change

- **BrandColorProvider**: Continues to handle CSS variable injection separately
- **Navigation component**: No changes - continues to display logo via `<img>` tag
- **Static favicon.ico**: Kept as fallback for unauthenticated states / loading
- **Database schema**: No changes (immutable constraint respected)

---

## Testing Checklist

1. **Favicon Updates**
   - [ ] After login, browser tab shows tenant logo instead of default favicon
   - [ ] Logo appears in browser tab, bookmarks, and browser history

2. **Fallback Behavior**
   - [ ] If tenant has no logo_url, default favicon.ico is shown
   - [ ] On logout, favicon reverts to default

3. **Cross-Browser**
   - [ ] Works in Chrome, Firefox, Safari, Edge

