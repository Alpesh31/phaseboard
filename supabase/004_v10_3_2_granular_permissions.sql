-- ATLAS360 V10.3.2 corrected granular task access.
-- Run AFTER 001, 002, 003. DO NOT run the superseded 004_v10_3 migration.
-- Requires a recoverable database backup or verified restore path. Existing tasks/comments/attachments are retained.
-- Do not apply if any prior V10.3/004 migration has already been applied.
-- Confirm historical task creator classifications before executing.
BEGIN;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by_admin boolean;
-- Snapshot original creator role for existing tasks. Review audit query in SETUP before applying.
UPDATE public.tasks t SET created_by_admin = (
  EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id=t.project_id AND m.user_id=t.created_by AND m.role='admin')
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id=t.project_id AND p.created_by=t.created_by)
) WHERE created_by_admin IS NULL;
ALTER TABLE public.tasks ALTER COLUMN created_by_admin SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN created_by_admin SET DEFAULT false;
ALTER TABLE public.task_access ADD COLUMN IF NOT EXISTS permission text;
UPDATE public.task_access SET permission='view' WHERE permission IS NULL;
ALTER TABLE public.task_access ALTER COLUMN permission SET DEFAULT 'view';
ALTER TABLE public.task_access ALTER COLUMN permission SET NOT NULL;
ALTER TABLE public.task_access DROP CONSTRAINT IF EXISTS task_access_permission_check;
ALTER TABLE public.task_access ADD CONSTRAINT task_access_permission_check CHECK (permission IN ('view','edit'));
-- Existing grants become VIEW ONLY. No data rows deleted.
-- All active members can see phase columns. Task rows are independently secured.
CREATE OR REPLACE FUNCTION public.can_see_phase(p_phase uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.phases p WHERE p.id=p_phase AND public.my_role(p.project_id) IS NOT NULL)
$$;
CREATE OR REPLACE FUNCTION public.can_see_task(p_task uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=p_task AND (
  public.my_role(t.project_id)='admin'
  OR (public.my_role(t.project_id) IN ('editor','viewer') AND t.created_by_admin)
  OR (public.my_role(t.project_id)='editor' AND t.created_by=(SELECT auth.uid()))
  OR (public.my_role(t.project_id) IN ('editor','viewer') AND EXISTS(
   SELECT 1 FROM public.task_access a WHERE a.task_id=t.id AND a.user_id=(SELECT auth.uid())
  ))
 ))
$$;
CREATE OR REPLACE FUNCTION public.can_edit_task(p_task uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=p_task AND (
  public.my_role(t.project_id)='admin'
  OR (public.my_role(t.project_id)='editor' AND (
   (t.created_by=(SELECT auth.uid()) AND NOT t.created_by_admin)
   OR EXISTS(SELECT 1 FROM public.task_access a WHERE a.task_id=t.id AND a.user_id=(SELECT auth.uid()) AND a.permission='edit')
  ))
 ))
$$;
CREATE OR REPLACE FUNCTION public.guard_task_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text; v_phase_project uuid;
BEGIN
 IF TG_OP = 'INSERT' THEN
  v_role := public.my_role(NEW.project_id);
  IF NEW.created_by IS DISTINCT FROM auth.uid() OR v_role IS NULL OR v_role NOT IN ('admin','editor') THEN
   RAISE EXCEPTION 'Not authorized to create task';
  END IF;
  SELECT p.project_id INTO v_phase_project FROM public.phases p WHERE p.id = NEW.phase_id;
  IF v_phase_project IS DISTINCT FROM NEW.project_id THEN RAISE EXCEPTION 'Phase does not belong to task project'; END IF;
  NEW.created_by_admin := (v_role = 'admin');
 ELSIF TG_OP = 'UPDATE' THEN
  IF NOT public.can_edit_task(OLD.id) THEN RAISE EXCEPTION 'Not authorized to edit task'; END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_by_admin IS DISTINCT FROM OLD.created_by_admin THEN
   RAISE EXCEPTION 'Cannot change task project or creator';
  END IF;
  SELECT p.project_id INTO v_phase_project FROM public.phases p WHERE p.id = NEW.phase_id;
  IF v_phase_project IS DISTINCT FROM NEW.project_id THEN RAISE EXCEPTION 'Phase does not belong to task project'; END IF;
 END IF;
 NEW.visible_to_everyone := false;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
ALTER TABLE public.tasks ALTER COLUMN visible_to_everyone SET DEFAULT false;
ALTER TABLE public.phases ALTER COLUMN visible_to_everyone SET DEFAULT false;
-- Legacy flags no longer control visibility; retain old values for audit/rollback.
-- Allow users to read ONLY their own grant, and Admins to read all.
DROP POLICY IF EXISTS "task access self read" ON public.task_access;
CREATE POLICY "task access self read" ON public.task_access FOR SELECT TO authenticated USING (
 user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.my_role(t.project_id) IS NOT NULL)
);
DROP POLICY IF EXISTS "task access admin update" ON public.task_access;
CREATE POLICY "task access admin update" ON public.task_access FOR UPDATE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.my_role(t.project_id)='admin'))
 WITH CHECK(EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.my_role(t.project_id)='admin'));
-- Explicit task RLS policies. The trigger also enforces creator and phase invariants.
DROP POLICY IF EXISTS "tasks editor insert" ON public.tasks;
CREATE POLICY "tasks editor insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (
 public.my_role(project_id) IN ('admin','editor') AND created_by=(SELECT auth.uid())
 AND EXISTS(SELECT 1 FROM public.phases p WHERE p.id=phase_id AND p.project_id=project_id)
);
DROP POLICY IF EXISTS "tasks editor update" ON public.tasks;
CREATE POLICY "tasks editor update" ON public.tasks FOR UPDATE TO authenticated
 USING (public.can_edit_task(id)) WITH CHECK (
 public.my_role(project_id) IN ('admin','editor')
 AND EXISTS(SELECT 1 FROM public.phases p WHERE p.id=phase_id AND p.project_id=project_id)
);
DROP POLICY IF EXISTS "tasks editor delete" ON public.tasks;
CREATE POLICY "tasks editor delete" ON public.tasks FOR DELETE TO authenticated USING (public.can_edit_task(id));
DROP POLICY IF EXISTS "tasks visible" ON public.tasks;
CREATE POLICY "tasks visible" ON public.tasks FOR SELECT TO authenticated USING (public.can_see_task(id));
-- Admin alone may create, change, or remove explicit task grants.
DROP POLICY IF EXISTS "task access admin insert" ON public.task_access;
CREATE POLICY "task access admin insert" ON public.task_access FOR INSERT TO authenticated WITH CHECK (
 EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.my_role(t.project_id)='admin')
);
DROP POLICY IF EXISTS "task access admin delete" ON public.task_access;
CREATE POLICY "task access admin delete" ON public.task_access FOR DELETE TO authenticated USING (
 EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.my_role(t.project_id)='admin')
);
DROP POLICY IF EXISTS "task access admin read" ON public.task_access;
CREATE POLICY "task access admin read" ON public.task_access FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.my_role(t.project_id)='admin')
);
-- Never grant edit permission to Viewer, including through direct API.
CREATE OR REPLACE FUNCTION public.guard_task_access_permission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_project uuid; v_role text;
BEGIN
 SELECT t.project_id INTO v_project FROM public.tasks t WHERE t.id=NEW.task_id;
 SELECT m.role INTO v_role FROM public.project_members m WHERE m.project_id=v_project AND m.user_id=NEW.user_id;
 IF v_role IS NULL THEN RAISE EXCEPTION 'User must be a project member'; END IF;
 IF NEW.permission='edit' AND v_role <> 'editor' THEN RAISE EXCEPTION 'Edit access is only available to Editors'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_task_access_permission ON public.task_access;
CREATE TRIGGER trg_task_access_permission BEFORE INSERT OR UPDATE ON public.task_access FOR EACH ROW EXECUTE FUNCTION public.guard_task_access_permission();
-- Remove stale explicit grants on membership removal.
CREATE OR REPLACE FUNCTION public.revoke_removed_member_grants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.task_access a USING public.tasks t WHERE a.task_id=t.id AND t.project_id=OLD.project_id AND a.user_id=OLD.user_id;
 DELETE FROM public.phase_access a USING public.phases p WHERE a.phase_id=p.id AND p.project_id=OLD.project_id AND a.user_id=OLD.user_id;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_revoke_removed_member_grants ON public.project_members;
CREATE TRIGGER trg_revoke_removed_member_grants AFTER DELETE ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.revoke_removed_member_grants();
COMMIT;
