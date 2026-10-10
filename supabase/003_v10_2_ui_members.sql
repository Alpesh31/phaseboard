-- Phaseboard V10.2: run ONCE in ATLAS260 Supabase SQL Editor.
-- Keeps all existing tasks, phase/task permissions, and free-text contributors.
-- Existing free-text contributors have user_id=NULL; new selections use member IDs.
ALTER TABLE public.task_contributors
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_task_contributors_user_id ON public.task_contributors(user_id);
-- Update the displayed project name only; never change project IDs or membership.
UPDATE public.projects SET name = 'ATLAS360' WHERE name = 'Phaseboard';

-- Prevent assigning an account outside the task's project to a contributor row.
CREATE OR REPLACE FUNCTION public.guard_contributor_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE task_project uuid;
BEGIN
 IF NEW.user_id IS NOT NULL THEN
  SELECT project_id INTO task_project FROM public.tasks WHERE id=NEW.task_id;
  IF NOT EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id=task_project AND m.user_id=NEW.user_id) THEN
   RAISE EXCEPTION 'Contributor must be a current project member';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_contributor_membership ON public.task_contributors;
CREATE TRIGGER trg_guard_contributor_membership
BEFORE INSERT OR UPDATE ON public.task_contributors
FOR EACH ROW EXECUTE FUNCTION public.guard_contributor_membership();
