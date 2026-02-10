

# Add Training Page with Admin-Managed Video Library

## Overview

Add a `/staff/training` route accessible to all staff. The page displays a list of training videos stored in a new database table. Admins can add, edit, and remove videos. All staff can browse and watch them. Videos are embedded from Google Drive using iframes.

## Database

A new table is needed: `training_videos`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default gen_random_uuid() |
| tenant_id | uuid (FK) | References tenants.id |
| title | text | Video title |
| description | text | Optional description |
| drive_file_id | text | The Google Drive file ID extracted from the share link |
| sort_order | integer | Controls display order, default 0 |
| is_active | boolean | Soft-delete/hide toggle, default true |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Default now() |
| created_by | uuid (FK) | References auth.users(id) |

RLS policies:
- SELECT: All authenticated users within the same tenant
- INSERT/UPDATE/DELETE: Only users with ADMIN or ACCOUNT_OWNER staff roles

## File Changes

### 1. New file: `src/pages/Training.tsx`

The main Training page with two sections:

- **Video list (left/top)**: Cards showing title, description, and a thumbnail. Clicking a card selects it.
- **Video player (right/main area)**: An iframe embedding the selected Google Drive video using the `https://drive.google.com/file/d/{drive_file_id}/preview` URL format.
- **Admin controls**: If the user has ADMIN or ACCOUNT_OWNER roles, show "Add Video", "Edit", and "Delete" buttons. The "Add Video" dialog asks for a title, description, and the Google Drive share link (the component extracts the file ID automatically).

### 2. `src/config/routes.ts`

Add `TRAINING: '/staff/training'` to `STAFF_ROUTES`.

### 3. `src/config/navigation.ts`

Add a "Training" entry to `STAFF_NAVIGATION` using the `GraduationCap` icon from lucide-react. Position it after "Messages" and before "Profile". No `requireAdmin` flag since all staff can view it.

### 4. `src/portals/StaffPortalApp.tsx`

Add a route: `<Route path="/training" element={<Training />} />` in the core business functionality section (available to all staff).

### 5. New file: `src/hooks/useTrainingVideos.tsx`

A hook using the existing `useSupabaseQuery` and `useSupabaseMutation` patterns for CRUD operations on `training_videos`. Provides:
- `videos` (list, filtered to active, ordered by sort_order)
- `addVideo`, `updateVideo`, `deleteVideo` mutations
- `refetch` for post-mutation refresh

## How Google Drive Embedding Works

When a user pastes a Google Drive share link like:
`https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing`

The component extracts the file ID (`1aBcDeFgHiJkLmNoPqRsTuVwXyZ`) and stores it. To play the video, it renders:

```html
<iframe
  src="https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/preview"
  width="100%"
  height="100%"
  allow="autoplay"
  allowFullScreen
/>
```

This works for any Google Drive video set to "Anyone with the link can view."

## UI Layout

```text
+----------------------------------------------------------+
|  Training                              [+ Add Video] (admin only)  |
+----------------------------------------------------------+
|                                                          |
|  +--------------------------------------------------+   |
|  |                                                    |   |
|  |          Selected Video Player (iframe)            |   |
|  |                                                    |   |
|  +--------------------------------------------------+   |
|                                                          |
|  Video 1 Card  |  Video 2 Card  |  Video 3 Card  | ...  |
|  (selected)    |                |                 |      |
+----------------------------------------------------------+
```

- Video player takes the top/main area
- Video cards are displayed in a responsive grid below
- Selected card is visually highlighted
- Admin users see edit/delete icons on each card

## What Does NOT Change

- No changes to the authentication system, Layout, or Navigation component logic (Navigation already dynamically renders items from `STAFF_NAVIGATION`).
- No changes to existing pages or hooks.
- No changes to any existing database tables.
