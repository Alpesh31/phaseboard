-- Phaseboard V9 upgrade for existing ATLAS260 foundation. Run ONCE in SQL Editor.
-- Do not rerun 001_foundation.sql; it has already been installed.

-- Keep image objects private. Signed URLs are generated only after a permitted task read.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('task-images','task-images',false,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

-- Path format: project_uuid/task_uuid/random_uuid
-- The access function checks BOTH task and phase visibility through existing RLS helpers.
create or replace function public.storage_task_id(p_name text)
returns uuid language plpgsql stable set search_path = '' as $$
declare v uuid;
begin
 if split_part(p_name,'/',2) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
 v:=split_part(p_name,'/',2)::uuid;
 return v;
exception when others then return null;
end $$;

create policy "phaseboard images read" on storage.objects for select to authenticated
using(bucket_id='task-images' and public.can_see_task(public.storage_task_id(name)));
create policy "phaseboard images upload" on storage.objects for insert to authenticated
with check(bucket_id='task-images' and public.can_edit_task(public.storage_task_id(name))
 and exists(select 1 from public.tasks t where t.id=public.storage_task_id(name) and split_part(name,'/',1)=t.project_id::text));
create policy "phaseboard images delete" on storage.objects for delete to authenticated
using(bucket_id='task-images' and public.can_edit_task(public.storage_task_id(name)));

-- Enable changes for realtime subscribers. RLS continues to control visibility.
do $$ begin
 alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;
do $$ begin
 alter publication supabase_realtime add table public.phases;
exception when duplicate_object then null;
end $$;

-- Harden a task update: Editors may not alter visibility, even through direct API calls.
-- Existing guard_task_changes trigger from foundation enforces this.
-- This release does not create accounts or grant project membership automatically.
