# EHR Complete - Electronic Health Records System

A comprehensive Electronic Health Records (EHR) system built with modern web technologies, featuring a unified authentication system and role-based access control.

## Project info

**URL**: https://lovable.dev/projects/2ec375d0-5a88-4ffe-8212-e3987cad80a6

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Authentication System](#authentication-system)
- [Environment Setup](#environment-setup)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

## Architecture Overview

This application uses a unified authentication and routing system that provides:

- **Single Authentication Flow**: One coordinated flow from login to dashboard
- **Role-Based Access Control**: Separate portals for clients and staff
- **Request Deduplication**: Prevents duplicate database queries
- **Circuit Breaker Protection**: Automatic recovery from failures
- **Session Management**: Persistent sessions across page refreshes

### User Types

1. **Client Users** (`role='client'`)
   - Access `/client/*` routes
   - Redirected to `/client/dashboard` after login

2. **Staff Users** (`role='staff'`)
   - **Clinical Staff** (`is_clinician=true`): Redirected to `/staff/registration`
   - **Non-Clinical Staff** (`is_clinician=false`): Redirected to `/staff/dashboard`
   - May have admin privileges (`is_admin=true`)

## Authentication System

The application uses a unified authentication system built with:

- **AuthenticationProvider**: Manages authentication state and user data
- **UnifiedRoutingGuard**: Enforces access control and routing rules
- **UnifiedRoleDetectionService**: Single source of truth for user roles
- **SessionCacheService**: Manages cached user data
- **CircuitBreakerRecoveryService**: Handles failure recovery

### Key Features

- Automatic role detection based on database records
- Intelligent query deduplication to prevent request stampedes
- Circuit breaker pattern for fault tolerance
- Redirect loop prevention
- Comprehensive error handling with user-friendly messages

For detailed documentation, see [Unified Authentication System Guide](docs/UNIFIED_AUTH_SYSTEM.md).

## Environment Setup

### Prerequisites

- Node.js 18+ and npm (install with [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Supabase account and project

### Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Development Settings
VITE_ENABLE_DEBUG_PANEL=true
```

### Database Setup

The application requires the following Supabase tables:

1. **profiles**: User profile information
   - `user_id` (uuid, primary key)
   - `email` (text)
   - `role` (text: 'staff' or 'client')
   - `tenant_id` (uuid)
   - `first_name`, `last_name`, `full_name` (text)

2. **clinicians**: Staff-specific attributes (for staff users only)
   - `user_id` (uuid, foreign key to profiles)
   - `is_clinician` (boolean)
   - `is_admin` (boolean)
   - `clinician_status` (text)

3. **user_permissions**: Permission flags (for staff users only)
   - `user_id` (uuid, foreign key to profiles)
   - `access_appointments`, `access_calendar`, etc. (boolean)

## How can I edit the code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/2ec375d0-5a88-4ffe-8212-e3987cad80a6) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/2ec375d0-5a88-4ffe-8212-e3987cad80a6) and click on Share -> Publish.

## Troubleshooting

### Common Issues

#### Circuit Breaker Open / Protection Mode

**Symptoms**: Error message "Service temporarily unavailable" or "Protection mode active"

**Solutions**:
1. Click the "Reset & Retry" button on the error page
2. Check your network connection
3. Verify Supabase is accessible
4. Wait 30 seconds for automatic recovery
5. Clear browser cache and sessionStorage if issue persists

**Prevention**: The circuit breaker opens after 3 consecutive failures to protect the system. It automatically attempts recovery after 30 seconds.

#### Redirect Loops

**Symptoms**: Page keeps redirecting, browser shows "Too many redirects" error

**Solutions**:
1. The system automatically detects and stops redirect loops after 3 attempts
2. Clear browser cache and sessionStorage
3. Use the "Reset & Retry" button when the error page appears
4. Check browser console for detailed logs

**Prevention**: The UnifiedRoutingGuard has built-in redirect loop prevention with rate limiting.

#### User Data Not Loading

**Symptoms**: User is logged in but data doesn't appear, or `user` is always `null`

**Solutions**:
1. Check browser console for errors
2. Verify Supabase connection is working
3. Ensure user exists in `profiles` table with correct `role`
4. For staff users, verify `clinicians` record exists
5. Try the "Refresh Data" option or call `refreshUserData()`

#### Session Expired

**Symptoms**: Automatically logged out, redirected to login page

**Solutions**:
1. Log in again - this is normal behavior after session expiration
2. Sessions are managed by Supabase and expire after a set period
3. Check Supabase project settings for session duration configuration

#### Permissions Not Working

**Symptoms**: User can't access features they should have access to

**Solutions**:
1. Verify `user_permissions` record exists for the user
2. Check permission flags in the database
3. Call `refreshUserData()` to reload permissions
4. Verify permission checks in code use optional chaining (`?.`)

### Debug Tools

#### Enable Debug Logging

In development mode, the system logs all authentication flow steps to the browser console:

```
[AuthenticationProvider] Login started
[RoleDetectionService] Detecting role for user: abc123
[UnifiedRoutingGuard] Routing decision: redirect to /staff/dashboard
```

#### AuthDebugPanel

In development mode, add the debug panel to see current auth state:

```tsx
import { AuthDebugPanel } from '@/components/auth';

// Add to your component
<AuthDebugPanel />
```

#### Clear All Auth State

To manually clear all authentication state:

```javascript
// In browser console
sessionStorage.clear();
window.location.reload();
```

Or use the `resetAuth()` method:

```tsx
const { resetAuth } = useAuth();
await resetAuth();
```

### Getting Help

1. Check the [Unified Authentication System Guide](docs/UNIFIED_AUTH_SYSTEM.md)
2. Review browser console logs for detailed error information
3. Check the [Requirements Document](.kiro/specs/unified-auth-routing-rebuild/requirements.md)
4. Check the [Design Document](.kiro/specs/unified-auth-routing-rebuild/design.md)

## Documentation

### Core Documentation

- **[Unified Authentication System Guide](docs/UNIFIED_AUTH_SYSTEM.md)**: Comprehensive developer guide for the authentication system
- **[Authentication Service README](src/services/auth/README.md)**: Technical documentation for auth services
- **[Routing System README](src/components/routing/README.md)**: Documentation for the routing guard system
- **[Testing Guide](src/test/UNIFIED_AUTH_TESTING_README.md)**: Testing documentation and examples

### Specification Documents

- **[Requirements Document](.kiro/specs/unified-auth-routing-rebuild/requirements.md)**: System requirements and acceptance criteria
- **[Design Document](.kiro/specs/unified-auth-routing-rebuild/design.md)**: Architecture and design decisions
- **[Implementation Tasks](.kiro/specs/unified-auth-routing-rebuild/tasks.md)**: Task breakdown and progress tracking

### Additional Resources

- **[Network Resilience Guide](docs/NETWORK_RESILIENCE_GUIDE.md)**: Network error handling and resilience patterns
- **[Resilient Client Migration Guide](docs/RESILIENT_CLIENT_MIGRATION_GUIDE.md)**: Step-by-step guide to migrate from old to new resilient Supabase client
- **[RLS Policy Guidelines](docs/RLS_POLICY_GUIDELINES.md)**: Row-level security policy documentation
- **[User Guide](docs/USER_GUIDE.md)**: End-user documentation

## Deployment

### Deploy to Production

Simply open [Lovable](https://lovable.dev/projects/2ec375d0-5a88-4ffe-8212-e3987cad80a6) and click on Share → Publish.

### Pre-Deployment Checklist

- [ ] All environment variables configured in production
- [ ] Database migrations applied
- [ ] RLS policies enabled and tested
- [ ] Circuit breaker thresholds configured appropriately
- [ ] Error monitoring and logging configured
- [ ] Performance monitoring enabled

### Post-Deployment Monitoring

Monitor the following metrics after deployment:

1. **Authentication Success Rate**: Should be >99%
2. **Circuit Breaker State**: Should remain closed under normal load
3. **Query Deduplication**: Check for reduced database query count
4. **Redirect Loops**: Should be 0 with the new system
5. **Session Persistence**: Users should remain logged in across page refreshes

## Custom Domain

To connect a custom domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Contributing

When contributing to this project:

1. Follow the existing code structure and patterns
2. Use the unified authentication system (AuthenticationProvider)
3. Use the UnifiedRoutingGuard for routing decisions
4. Add tests for new functionality
5. Update documentation as needed
6. Check for TypeScript errors before committing

## License

[Your License Here]
