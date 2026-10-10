-- Phaseboard V8 foundation. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', created_at timestamptz not null default now());
create table if not exists public.projects (id uuid primary key default gen_random_uuid(), name text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now());
create table if not exists public.project_members (project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in ('admin','editor','viewer')), primary key(project_id,user_id));
create table if not exists public.phases (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, name text not null, position int not null, visible_to_everyone boolean not null default true, unique(project_id,position), unique(id,project_id));
create table if not exists public.phase_access (phase_id uuid not null references public.phases(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, primary key(phase_id,user_id));
create table if not exists public.tasks (id uuid primary key default gen_random_uuid(), project_id uuid not null, phase_id uuid not null, title text not null, description text not null default '', priority text not null default 'Medium' check(priority in ('Low','Medium','High')), status text not null default 'Not Started' check(status in ('Not Started','In Progress','Blocked','Completed')), importance text not null default 'Maybe' check(importance in ('Must','Maybe','Mostly Not')), owner_name text not null default '', due_date date, visible_to_everyone boolean not null default true, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), foreign key(phase_id,project_id) references public.phases(id,project_id) on delete cascade);
create table if not exists public.task_access (task_id uuid not null references public.tasks(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, primary key(task_id,user_id));
create table if not exists public.task_contributors (task_id uuid not null references public.tasks(id) on delete cascade, name text not null, primary key(task_id,name));
create table if not exists public.comments (id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade, author_id uuid not null references auth.users(id), body text not null check(length(trim(body)) > 0), created_at timestamptz not null default now());
create table if not exists public.task_attachments (id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade, storage_path text not null unique, filename text not null, content_type text not null, bytes bigint not null check(bytes > 0 and bytes <= 8388608), created_by uuid not null references auth.users(id), created_at timestamptz not null default now());
create index if not exists idx_phases_project on public.phases(project_id);
create index if not exists idx_tasks_phase on public.tasks(phase_id);
create index if not exists idx_comments_task on public.comments(task_id);

-- SECURITY DEFINER avoids policy recursion; only authenticated caller's membership is checked.
create or replace function public.my_role(p_project uuid) returns text language sql stable security definer set search_path = '' as $$ select m.role from public.project_members m where m.project_id=p_project and m.user_id=(select auth.uid()) $$;
create or replace function public.can_see_phase(p_phase uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.phases p where p.id=p_phase and (public.my_role(p.project_id)='admin' or (public.my_role(p.project_id) in ('editor','viewer') and (p.visible_to_everyone or exists(select 1 from public.phase_access a where a.phase_id=p.id and a.user_id=(select auth.uid())))))) $$;
create or replace function public.can_see_task(p_task uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.tasks t where t.id=p_task and (public.my_role(t.project_id)='admin' or (public.can_see_phase(t.phase_id) and (t.visible_to_everyone or exists(select 1 from public.task_access a where a.task_id=t.id and a.user_id=(select auth.uid())))))) $$;
create or replace function public.can_edit_task(p_task uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.tasks t where t.id=p_task and public.my_role(t.project_id) in ('admin','editor') and public.can_see_task(t.id)) $$;
-- Enforce that Editors cannot alter visibility, and may only move to permitted phases.
create or replace function public.guard_task_changes() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='INSERT' then
   if new.created_by <> auth.uid() or public.my_role(new.project_id) not in ('admin','editor') or not public.can_see_phase(new.phase_id) then raise exception 'Not authorized to create task'; end if;
   if public.my_role(new.project_id)='editor' and new.visible_to_everyone=false then raise exception 'Only admins may restrict task visibility'; end if;
 elsif tg_op='UPDATE' then
   if new.project_id<>old.project_id or new.created_by<>old.created_by then raise exception 'Cannot change task project or creator'; end if;
   if public.my_role(old.project_id)<>'admin' and new.visible_to_everyone is distinct from old.visible_to_everyone then raise exception 'Only admins may change visibility'; end if;
   if not public.can_see_phase(new.phase_id) then raise exception 'Destination phase not accessible'; end if;
 end if;
 new.updated_at=now(); return new;
end $$;
drop trigger if exists trg_guard_tasks on public.tasks;
create trigger trg_guard_tasks before insert or update on public.tasks for each row execute function public.guard_task_changes();

-- Prevent removing the last admin (also enforced for role changes).
create or replace function public.guard_last_admin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if old.role='admin' and (tg_op='DELETE' or new.role<>'admin') and not exists(select 1 from public.project_members m where m.project_id=old.project_id and m.user_id<>old.user_id and m.role='admin') then raise exception 'Project must have at least one admin'; end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists trg_last_admin on public.project_members;
create trigger trg_last_admin before update or delete on public.project_members for each row execute function public.guard_last_admin();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.phases enable row level security;
alter table public.phase_access enable row level security;
alter table public.tasks enable row level security;
alter table public.task_access enable row level security;
alter table public.task_contributors enable row level security;
alter table public.comments enable row level security;
alter table public.task_attachments enable row level security;

create policy "profiles self read" on public.profiles for select to authenticated using (id=auth.uid());
create policy "profiles self insert" on public.profiles for insert to authenticated with check (id=auth.uid());
create policy "profiles self update" on public.profiles for update to authenticated using (id=auth.uid()) with check(id=auth.uid());
create policy "projects members read" on public.projects for select to authenticated using(public.my_role(id) is not null);
create policy "members read" on public.project_members for select to authenticated using(public.my_role(project_id) is not null);
-- Project creation and membership invitations must go through a trusted server endpoint, not direct browser writes.
create policy "phases visible" on public.phases for select to authenticated using(public.can_see_phase(id));
create policy "phases admin insert" on public.phases for insert to authenticated with check(public.my_role(project_id)='admin');
create policy "phases admin update" on public.phases for update to authenticated using(public.my_role(project_id)='admin') with check(public.my_role(project_id)='admin');
create policy "phases admin delete" on public.phases for delete to authenticated using(public.my_role(project_id)='admin');
create policy "phase access admin read" on public.phase_access for select to authenticated using(exists(select 1 from public.phases p where p.id=phase_id and public.my_role(p.project_id)='admin'));
create policy "phase access admin insert" on public.phase_access for insert to authenticated with check(exists(select 1 from public.phases p where p.id=phase_id and public.my_role(p.project_id)='admin'));
create policy "phase access admin delete" on public.phase_access for delete to authenticated using(exists(select 1 from public.phases p where p.id=phase_id and public.my_role(p.project_id)='admin'));
create policy "tasks visible" on public.tasks for select to authenticated using(public.can_see_task(id));
create policy "tasks editor insert" on public.tasks for insert to authenticated with check(public.my_role(project_id) in ('admin','editor') and public.can_see_phase(phase_id) and created_by=auth.uid());
create policy "tasks editor update" on public.tasks for update to authenticated using(public.can_edit_task(id)) with check(public.my_role(project_id) in ('admin','editor') and public.can_see_phase(phase_id));
create policy "tasks editor delete" on public.tasks for delete to authenticated using(public.can_edit_task(id));
create policy "task access admin read" on public.task_access for select to authenticated using(exists(select 1 from public.tasks t where t.id=task_id and public.my_role(t.project_id)='admin'));
create policy "task access admin insert" on public.task_access for insert to authenticated with check(exists(select 1 from public.tasks t where t.id=task_id and public.my_role(t.project_id)='admin'));
create policy "task access admin delete" on public.task_access for delete to authenticated using(exists(select 1 from public.tasks t where t.id=task_id and public.my_role(t.project_id)='admin'));
create policy "contributors read" on public.task_contributors for select to authenticated using(public.can_see_task(task_id));
create policy "contributors add" on public.task_contributors for insert to authenticated with check(public.can_edit_task(task_id));
create policy "contributors remove" on public.task_contributors for delete to authenticated using(public.can_edit_task(task_id));
create policy "comments read" on public.comments for select to authenticated using(public.can_see_task(task_id));
create policy "comments create" on public.comments for insert to authenticated with check(author_id=auth.uid() and public.can_see_task(task_id));
create policy "comments delete" on public.comments for delete to authenticated using(author_id=auth.uid() or exists(select 1 from public.tasks t where t.id=task_id and public.my_role(t.project_id)='admin'));
create policy "attachments read" on public.task_attachments for select to authenticated using(public.can_see_task(task_id));
create policy "attachments insert" on public.task_attachments for insert to authenticated with check(created_by=auth.uid() and public.can_edit_task(task_id));
create policy "attachments delete" on public.task_attachments for delete to authenticated using(public.can_edit_task(task_id));

-- Run the bootstrap script in SETUP-V8.md to create the first project and Admin.
-- Private Storage bucket policies and invitation endpoints are part of the next milestone.
