

# Training Page: Admin-Only Controls, Cover Image Upload, and Click-to-Play Dialog

## Changes

### 1. Admin permission fix
Replace `isAdminOrAccountOwner(user?.staffAttributes?.staffRoleCodes)` with `isAdmin` from `useAuth()`. This already exists in the auth context and checks the `user_roles` table. The "+ Add Video" button, Edit button, and Delete button will all use this single `isAdmin` boolean.

### 2. Click-to-play video dialog (from previously approved plan)
Remove the always-visible video player at the top. Remove `selectedVideo` state and auto-select logic. Instead, clicking a video card opens a Dialog containing the iframe player, title, and description. Closing the dialog returns to the grid.

### 3. Cover image support

**Database**: Add a `cover_image_url` column (text, nullable) to the `training_videos` table.

**Storage**: Create a new `training-covers` Supabase Storage bucket (public read, authenticated upload) for cover images.

**UI changes in the Add/Edit Dialog**: Add an optional "Cover Image" field with a file input. When a file is selected, it uploads to the `training-covers` bucket and stores the public URL in `cover_image_url`.

**Video grid cards**: If a video has a `cover_image_url`, display it as the card thumbnail background. Otherwise, fall back to the current Play icon placeholder.

### Technical Details

**Files modified:**
- `src/pages/Training.tsx` -- All three changes above
- `src/hooks/useTrainingVideos.tsx` -- Add `cover_image_url` to the `TrainingVideo` interface

**Database migration:**
- `ALTER TABLE public.training_videos ADD COLUMN cover_image_url text;`

**Storage bucket creation:**
- Create `training-covers` bucket with public access
- RLS: authenticated users can upload, public can read

**No changes to any existing database columns or tables** -- only adding a new nullable column to the new `training_videos` table.

