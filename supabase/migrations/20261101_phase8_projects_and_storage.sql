-- Chroma Studio — Phase 8 Database Migration
-- Projects Table, Indexes, RLS Policies, Versioning Trigger & Storage Bucket

-- 1. Create public.projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  project_type TEXT NOT NULL CHECK (project_type IN ('photo', 'template', 'collage', 'carousel')),
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_path TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ
);

-- 2. Indexes for user ownership, active projects, and sorting
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON public.projects(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_type ON public.projects(user_id, project_type);
CREATE INDEX IF NOT EXISTS idx_projects_version ON public.projects(id, version);

-- 3. Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies on public.projects
DROP POLICY IF EXISTS "Users can select own projects" ON public.projects;
CREATE POLICY "Users can select own projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- 5. Automatic updated_at and version increment function & trigger
CREATE OR REPLACE FUNCTION public.handle_project_version_and_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  IF NEW.version = OLD.version THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_updated ON public.projects;
CREATE TRIGGER on_project_updated
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_project_version_and_updated_at();

-- 6. Storage Bucket 'projects' for private user assets and thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'projects',
  'projects',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/svg+xml'];

-- 7. Storage RLS Policies for 'projects' bucket
DROP POLICY IF EXISTS "Users can view own project assets" ON storage.objects;
CREATE POLICY "Users can view own project assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'projects' AND
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can upload own project assets" ON storage.objects;
CREATE POLICY "Users can upload own project assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'projects' AND
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can update own project assets" ON storage.objects;
CREATE POLICY "Users can update own project assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'projects' AND
    (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'projects' AND
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can delete own project assets" ON storage.objects;
CREATE POLICY "Users can delete own project assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'projects' AND
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );
