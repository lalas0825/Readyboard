-- Fix 3: Add photo_type to field_reports
-- Allows distinguishing progress photos from blocker evidence photos.
-- Default 'progress' is backwards-compatible with all existing rows.

ALTER TABLE field_reports
  ADD COLUMN IF NOT EXISTS photo_type TEXT DEFAULT 'progress'
  CHECK (photo_type IN ('progress', 'blocker', 'evidence', 'safety'));
