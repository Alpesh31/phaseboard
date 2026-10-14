'use client';
import UserManagement from '@/components/user-management';
import { useProfileMenu } from '@/components/profile-menu';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BoardData, Priority, Status, Importance, Task } from '@/lib/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAccess } from '@/components/auth-shell';

const statuses:Status[]=['Not Started','In Progress','Blocked','Completed'];
const priorities:Priority[]=['Low','Medium','High'];
const importanceOptions:Importance[]=['Must','Maybe','Mostly Not'];
const uid=()=>crypto.randomUUID();
const projectNames=['ATLAS360','QE Tasks','Admin Task','Personal'] as const;
type IdeaPreview={task_id:string;title:string;idea_project:string;priority:Priority;status:Status;due_date:string|null};
const priorityWeight:Record<Priority,number>={High:0,Medium:1,Low:2};
const taskSort=(a:{status:Status;priority:Priority;dueDate:string},b:{status:Status;priority:Priority;dueDate:string})=>
 Number(a.status==='Completed')-Number(b.status==='Completed') ||
 priorityWeight[a.priority]-priorityWeight[b.priority] ||
 (a.dueDate||'9999-12-31').localeCompare(b.dueDate||'9999-12-31');
const dueWarning=(dueDate:string,status:Status)=>{
 if(!dueDate||status==='Completed')return '';
 const now=new Date();const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const due=new Date(`${dueDate}T00:00:00`);const days=Math.round((due.getTime()-today.getTime())/86400000);
 return days<=1?'urgent':days<=3?'soon':days<=7?'upcoming':'';
};
type DbTask = {id:string;title:string;description:string;priority:Priority;status:Status;importance:Importance;owner_name:string;due_date:string|null;phase_id:string;created_by:string;created_by_admin:boolean;visible_to_everyone:boolean;task_contributors:{name:string;user_id:string|null}[];task_attachments:{id:string;filename:string;content_type:string;bytes:number;storage_path:string}[]};
const convertTask=(t:DbTask):Task=>({id:t.id,title:t.title,description:t.description,priority:t.priority,status:t.status,importance:t.importance,owner:t.owner_name,contributors:(t.task_contributors||[]).map(c=>c.user_id||c.name),dueDate:t.due_date||'',phaseId:t.phase_id,createdBy:t.created_by,createdByAdmin:t.created_by_admin,attachments:(t.task_attachments||[]).map(a=>({id:a.id,name:a.filename,type:a.content_type,size:a.bytes}))});

export default function Home(){
 const boardRef=useRef<HTMLElement|null>(null); const touchStart=useRef<{x:number,y:number}|null>(null); const [activePhase,setActivePhase]=useState(0); const [showAllIdeas,setShowAllIdeas]=useState(false); const [ideaPreviews,setIdeaPreviews]=useState<IdeaPreview[]>([]); const [newIdeaProject,setNewIdeaProject]=useState('ATLAS360');
 const access=useAccess(); const client=useMemo(()=>getSupabaseClient(),[]);
 const [board,setBoard]=useState<BoardData>({projectName:'Task Manager',phases:[],tasks:[]});
 const [ready,setReady]=useState(false); const [error,setError]=useState('');
 const [selected,setSelected]=useState<Task|null>(null); const [uploading,setUploading]=useState(false); const [imageError,setImageError]=useState(''); const [newPhase,setNewPhase]=useState<string|null>(null); const [quickOpen,setQuickOpen]=useState(false);
 const [allowed,setAllowed]=useState<Record<string,string[]>>({});
 const [taskGrants,setTaskGrants]=useState<Record<string,Record<string,'view'|'edit'>>>({});
 const [myGrants,setMyGrants]=useState<Record<string,'view'|'edit'>>({});
 const [members,setMembers]=useState<{user_id:string;role:string;display_name?:string;email?:string}[]>([]);
 // Resolve a user's display name from their user ID
const getMemberName = (userId: string): string => {
  const member = members.find(m => m.user_id === userId);

  return (
    member?.display_name?.trim() ||
    member?.email ||
    'Unknown user'
  );
};
 const [comments,setComments]=useState<{id:string;author_id:string;body:string;created_at:string}[]>([]);
 const [commentDraft,setCommentDraft]=useState('');
 const [adminPanel,setAdminPanel]=useState(false); const [usersOpen,setUsersOpen]=useState(false);

 const [attachmentsPaths,setAttachmentsPaths]=useState<Record<string,string>>({});
 const { registerActions }=useProfileMenu();
 const editable=access?.role==='admin'||access?.role==='editor';
 const admin=access?.role==='admin';
 const canEditTask=(task:Task)=>!!access&&(admin||(access.role==='editor'&&((task.createdBy===access.userId&&!task.createdByAdmin)||myGrants[task.id]==='edit')));
 const refresh=async()=>{
  if(!access)return;
  const [ph,ts,pr,mem,grants,previews]=await Promise.all([
   client.from('phases').select('id,name,visible_to_everyone').eq('project_id',access.projectId).order('position'),
   client.from('tasks').select('id,title,description,priority,status,importance,owner_name,due_date,phase_id,created_by,created_by_admin,visible_to_everyone,task_contributors(name,user_id),task_attachments(id,filename,content_type,bytes,storage_path)').eq('project_id',access.projectId).order('created_at'),
   client.from('projects').select('name').eq('id',access.projectId).single(),
   client.from('project_members').select('user_id,role').eq('project_id',access.projectId),
   client.from('task_access').select('task_id,permission').eq('user_id',access.userId),
   client.from('idea_previews').select('task_id,title,idea_project,priority,status,due_date').eq('project_id',access.projectId)
  ]);
  const failure=ph.error||ts.error||pr.error||mem.error||grants.error||previews.error;
  if(failure){setError(failure.message);setReady(true);return;}
setError('');
setIdeaPreviews((previews.data||[]) as IdeaPreview[]);

setMembers(previousMembers => {
  const existingById = new Map(
    previousMembers.map(member => [member.user_id, member])
  );

  return (mem.data || []).map(member => ({
    ...existingById.get(member.user_id),
    ...member
  }));
});

setMyGrants(
  Object.fromEntries(
    (grants.data || []).map(g => [
      g.task_id,
      g.permission as 'view' | 'edit'
    ])
  )
);  setBoard({projectName:pr.data?.name||'Task Manager',phases:(ph.data||[]).map(p=>({id:p.id,name:p.name})),tasks:((ts.data||[]) as unknown as DbTask[]).map(convertTask)});
  setAttachmentsPaths(Object.fromEntries((ts.data||[]).flatMap(t=>(t.task_attachments||[]).map(a=>[a.id,a.storage_path]))));
  setReady(true);
 };
 useEffect(()=>{if(!access)return;let live=true;const load=async()=>{try{const {data:{session}}=await client.auth.getSession();if(!session)return;const res=await fetch(`/api/members?projectId=${encodeURIComponent(access.projectId)}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});if(!res.ok)throw new Error("Could not load member names");const result=await res.json();if (live) {
  setMembers(previousMembers => {
    const existingById = new Map(
      previousMembers.map(member => [member.user_id, member])
    );

    return (result.members || []).map(
      (member: {
        user_id: string;
        role: string;
        display_name?: string;
        email?: string;
      }) => ({
        ...existingById.get(member.user_id),
        ...member
      })
    );
  });
}}catch(e){if(live)fail(e)}};void load();return()=>{live=false}},[access?.projectId,usersOpen]);
 useEffect(()=>registerActions(admin?{manageUsers:()=>setUsersOpen(true),managePhases:()=>{setAdminPanel(true);void Promise.all(board.phases.map(p=>loadAccess('phase',p.id)));}}:{}),[admin,registerActions]);
 useEffect(()=>{void refresh();},[access?.projectId]);
 useEffect(()=>{if(!access)return;const channel=client.channel('phaseboard-'+access.projectId)
  .on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:`project_id=eq.${access.projectId}`},()=>{void refresh()})
  .on('postgres_changes',{event:'*',schema:'public',table:'phases',filter:`project_id=eq.${access.projectId}`},()=>{void refresh()})
  .subscribe();return()=>{void client.removeChannel(channel)}},[access?.projectId]);
 const ideasPhase=board.phases.find(p=>p.name==='Ideas / To-Do');
 const visibleColumns=board.phases.filter(p=>projectNames.includes(p.name as typeof projectNames[number])&&(admin||!['Admin Task','Personal'].includes(p.name)));
 const sortedIdeas=[...ideaPreviews].sort((a,b)=>taskSort({status:a.status,priority:a.priority,dueDate:a.due_date||''},{status:b.status,priority:b.priority,dueDate:b.due_date||''}));
 const displayedIdeas=showAllIdeas?sortedIdeas:sortedIdeas.slice(0,8);
 const fail=(e:unknown)=>setError(e instanceof Error?e.message:String(e));
 const updateTask=async(task:Task)=>{
  if(!canEditTask(task))return;
  setSelected(task);
  const {error:e}=await client.from('tasks').update({title:task.title,description:task.description,status:task.status,priority:task.priority,importance:task.importance,owner_name:task.owner,due_date:task.dueDate||null,phase_id:task.phaseId}).eq('id',task.id);
  if(e){fail(e);return;}
  const current=board.tasks.find(t=>t.id===task.id);
  if(JSON.stringify(current?.contributors)!==JSON.stringify(task.contributors)){
   const {error:delErr}=await client.from('task_contributors').delete().eq('task_id',task.id);
   if(delErr){fail(delErr);return;}
   if(task.contributors.length){const {error:insErr}=await client.from('task_contributors').insert(task.contributors.map(value=>{const member=members.find(m=>m.user_id===value);return {task_id:task.id,name:member?`${member.display_name||member.email||value} · ${member.user_id.slice(0,8)}`:value,user_id:member?.user_id||null}}));if(insErr)fail(insErr);}
  }
  await refresh();
 };
 const removeTask=async(id:string)=>{if(!editable||!board.tasks.some(t=>t.id===id&&canEditTask(t)))return;const {error:e}=await client.from('tasks').delete().eq('id',id);if(e)fail(e);else{setSelected(null);await refresh();}};
 const moveTask=async(taskId:string,phaseId:string)=>{if(!editable||!board.tasks.some(t=>t.id===taskId&&canEditTask(t)))return;const {error:e}=await client.from('tasks').update({phase_id:phaseId}).eq('id',taskId);if(e)fail(e);else await refresh();};
const createTask = async (title: string, phaseId?: string, ideaProject='ATLAS360') => {
  if (!access || !editable) return;

  const dest = phaseId || ideasPhase?.id;
  if (!dest) return;

  const creator = members.find(
    (member) => member.user_id === access.userId
  );

  const creatorName =
    creator?.display_name ||
    creator?.email ||
    access.userId;

  const { error: e } = await client.from('tasks').insert({
    project_id: access.projectId,
    phase_id: dest,
    title,
    created_by: access.userId,
    owner_name: creatorName,
    idea_project: ideaProject
  });

  if (e) {
    fail(e);
  } else {
    await refresh();
  }
};
 const addTask=(e:FormEvent<HTMLFormElement>,phaseId:string)=>{e.preventDefault();const form=e.currentTarget;const title=String(new FormData(form).get('title')||'').trim();if(!title)return;void createTask(title,phaseId,phaseId===ideasPhase?.id?newIdeaProject:(board.phases.find(p=>p.id===phaseId)?.name||'ATLAS360'));form.reset();setNewPhase(null)};
 const quickAdd=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=e.currentTarget;const title=String(new FormData(form).get('title')||'').trim();if(!title)return;void createTask(title,ideasPhase?.id,newIdeaProject);form.reset();setQuickOpen(false)};
 const uploadImages=async(files:FileList|null)=>{
  if(!files||!selected||!access||!canEditTask(selected))return;
  setUploading(true);setImageError('');
  try {for(const file of Array.from(files)){
   if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('Use JPG, PNG, WebP or GIF images.');
   if(file.size>8*1024*1024)throw new Error('Each image must be 8 MB or smaller.');
   const path=`${access.projectId}/${selected.id}/${uid()}`;
   const {error:upErr}=await client.storage.from('task-images').upload(path,file,{contentType:file.type});if(upErr)throw upErr;
   const {error:metaErr}=await client.from('task_attachments').insert({task_id:selected.id,storage_path:path,filename:file.name,content_type:file.type,bytes:file.size,created_by:access.userId});
   if(metaErr){await client.storage.from('task-images').remove([path]);throw metaErr;}
  }await refresh();const {data}=await client.from('tasks').select('id,title,description,priority,status,importance,owner_name,due_date,phase_id,created_by,created_by_admin,task_contributors(name,user_id),task_attachments(id,filename,content_type,bytes,storage_path)').eq('id',selected.id).single();if(data)setSelected(convertTask(data as unknown as DbTask));
  }catch(e){setImageError(e instanceof Error?e.message:'Image upload failed.')}finally{setUploading(false)}
 };
 const removeAttachment=async(id:string)=>{if(!selected||!canEditTask(selected))return;const path=attachmentsPaths[id];const {error:e}=await client.from('task_attachments').delete().eq('id',id);if(e){fail(e);return;}if(path)await client.storage.from('task-images').remove([path]);setSelected({...selected,attachments:selected.attachments.filter(a=>a.id!==id)});await refresh();};
 const openTask=async(task:Task)=>{setSelected(task);if(admin)void loadTaskGrants(task.id);setComments([]);setCommentDraft('');const {data,error:e}=await client.from('comments').select('id,author_id,body,created_at').eq('task_id',task.id).order('created_at');if(e)fail(e);else setComments(data||[])};
 const postComment=async()=>{if(!access||!selected||!commentDraft.trim())return;const {error:e}=await client.from('comments').insert({task_id:selected.id,author_id:access.userId,body:commentDraft.trim()});if(e){fail(e);return;}setCommentDraft('');void openTask(selected)};
 const deleteComment=async(id:string)=>{const {error:e}=await client.from('comments').delete().eq('id',id);if(e)fail(e);else if(selected)void openTask(selected)};
 const changeAccess=async(type:'phase'|'task',id:string,userId:string,enabled:boolean)=>{if(!admin)return;const table=type==='phase'?'phase_access':'task_access';const field=type==='phase'?'phase_id':'task_id';const query=enabled?client.from(table).insert({[field]:id,user_id:userId}):client.from(table).delete().eq(field,id).eq('user_id',userId);const {error:e}=await query;if(e)fail(e);else {await loadAccess(type,id);await refresh();}};
 const loadAccess=async(type:'phase'|'task',id:string)=>{const table=type==='phase'?'phase_access':'task_access';const field=type==='phase'?'phase_id':'task_id';const {data,error:e}=await client.from(table).select('user_id').eq(field,id);if(e)fail(e);else setAllowed(old=>({...old,[id]:(data||[]).map(x=>x.user_id)}));};
 const loadTaskGrants=async(id:string)=>{const {data,error:e}=await client.from('task_access').select('user_id,permission').eq('task_id',id);if(e)fail(e);else setTaskGrants(old=>({...old,[id]:Object.fromEntries((data||[]).map(x=>[x.user_id,x.permission as 'view'|'edit']))}));};
 const setTaskGrant=async(taskId:string,userId:string,permission:'none'|'view'|'edit')=>{if(!admin)return;const query=permission==='none'?client.from('task_access').delete().eq('task_id',taskId).eq('user_id',userId):client.from('task_access').upsert({task_id:taskId,user_id:userId,permission},{onConflict:'task_id,user_id'});const {error:e}=await query;if(e)fail(e);else{await loadTaskGrants(taskId);await refresh();}};
 const phaseStats=useMemo(()=>Object.fromEntries(board.phases.map(p=>{const list=board.tasks.filter(t=>t.phaseId===p.id);return[p.id,{done:list.filter(t=>t.status==='Completed').length,total:list.length}]})),[board]);
 if(!ready)return <main><p role='status'>Loading Task Manager…</p></main>;
 return <main>
  {error&&<p role="alert" className="imageError">{error} <button onClick={()=>void refresh()}>Retry</button></p>}
  <header className="topbar"><div><div className="brand">Task Manager</div><div className="tagline">Ideas, priorities and projects in one place.</div></div>{editable&&<button className="quickButton" onClick={()=>setQuickOpen(true)}>＋ Quick Add</button>}</header>

  {admin&&adminPanel&&<div className="overlay" onMouseDown={()=>setAdminPanel(false)}><section id="admin-visibility-panel" role="dialog" aria-modal="true" className="adminPanel phaseModal" onMouseDown={e=>e.stopPropagation()} aria-label="Phase access settings"><div className="modalHead"><h2>Phase access</h2><button type="button" onClick={()=>setAdminPanel(false)} aria-label="Close phase access">×</button></div><p>Editors can see phase columns to create their own private tasks. Viewers see a phase only when it is explicitly granted here or when a task in that phase is shared with them. Phase access never reveals other tasks.</p>{board.phases.map(phase=><div className="adminPhaseRow" key={phase.id}><strong>{phase.name}</strong><div className="adminMemberList"><button type="button" className="ghost" onClick={()=>void loadAccess('phase',phase.id)}>Refresh phase grants</button>{members.filter(m=>m.role==='viewer').length===0?<p>No Viewers have been added yet.</p>:members.filter(m=>m.role==='viewer').map(m=><label key={m.user_id}><input type="checkbox" checked={(allowed[phase.id]||[]).includes(m.user_id)} onChange={e=>void changeAccess('phase',phase.id,m.user_id,e.target.checked)}/>{m.display_name||m.email||m.user_id.slice(0,8)} (Viewer)</label>)}</div></div>)}</section></div>}
  {ideasPhase&&<section className="ideasStrip" aria-label="Ideas and to-do">
   <div className="ideasHeader"><div><span className="phaseNum">INBOX</span><h2>Ideas / To-Do <span className="count">{sortedIdeas.length}</span></h2></div>{editable&&<button className="addTask" type="button" onClick={()=>setNewPhase(ideasPhase.id)}>＋ Add idea</button>}</div>
   {editable&&newPhase===ideasPhase.id&&<form className="quickAdd ideaAdd" onSubmit={e=>addTask(e,ideasPhase.id)}><input name="title" required autoFocus placeholder="Capture an idea..."/><label>Project <ProjectPicker
  value={newIdeaProject}
  onChange={setNewIdeaProject}
  options={projectNames.filter(
    (name) =>
      admin || !["Admin Task", "Personal"].includes(name)
  )}
/></label><button>Add</button><button type="button" className="ghost" onClick={()=>setNewPhase(null)}>Cancel</button></form>}
   <div className="ideasGrid">{displayedIdeas.map(idea=>{const task=board.tasks.find(t=>t.id===idea.task_id);const privateIdea=!task;const warning=dueWarning(idea.due_date||'',idea.status);return <article key={idea.task_id} className={`card ideaCard project-${idea.idea_project.toLowerCase().replaceAll(' ','-')} ${privateIdea?'privatePreview':''}`} role={task?'button':undefined} tabIndex={task?0:undefined} onClick={()=>{if(task)void openTask(task)}} onKeyDown={e=>{if(task&&(e.key==='Enter'||e.key===' ')){e.preventDefault();void openTask(task)}}}>
<div className="ideaCardHeader">
  <span className="projectPill">
    {idea.idea_project}
  </span>

  {!privateIdea && (
    <div className="ideaHeaderTags">
      <span className={`status ${idea.status.replaceAll(" ", "").toLowerCase()}`}>
        {idea.status}
      </span>
      <span className={`priority ${idea.priority.toLowerCase()}`}>
        ⚑ {idea.priority}
      </span>
    </div>
  )}
</div>

<h3>{task?.title || idea.title}</h3>

{privateIdea ? (
  <p className="privateLabel">
    Restricted preview · Details not shared
  </p>
) : null}

{!privateIdea && idea.due_date && (
  <p className={`dueBadge ${warning}`}>
    Due {idea.due_date}
    {warning === "urgent"
      ? " · Urgent"
      : warning === "soon"
      ? " · Soon"
      : warning === "upcoming"
      ? " · Upcoming"
      : ""}
  </p>
)}   </article>})}</div>
   {sortedIdeas.length===0&&<p className="emptyBoard">No ideas yet.</p>}
   {sortedIdeas.length>8&&<button className="viewIdeas" type="button" onClick={()=>setShowAllIdeas(v=>!v)}>{showAllIdeas?'View Less':`View More (${sortedIdeas.length-8} more)`}</button>}
  </section>}
  <nav className="mobilePhases" aria-label="Choose project">{visibleColumns.map((phase,index)=><button key={phase.id} type="button" className={activePhase===index?'active':''} aria-current={activePhase===index?'step':undefined} onClick={()=>setActivePhase(index)}>{phase.name}</button>)}</nav>
  <section className="board" ref={boardRef} onTouchStart={e=>{if(window.innerWidth>700)return;const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{if(window.innerWidth>700||!touchStart.current)return;const t=e.changedTouches[0];const dx=t.clientX-touchStart.current.x;const dy=t.clientY-touchStart.current.y;touchStart.current=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4){setActivePhase(i=>Math.max(0,Math.min(visibleColumns.length-1,i+(dx<0?1:-1))));}}}>
   {visibleColumns.map((phase,index)=>{const stat=phaseStats[phase.id];return <div data-mobile-active={activePhase===index} className={`column project-${phase.name.toLowerCase().replaceAll(' ','-')}`} key={phase.id} onDragOver={e=>{if(editable)e.preventDefault()}} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('taskId');if(id&&editable)void moveTask(id,phase.id)}}>
    <div className="columnHead"><div><span className="phaseNum">PROJECT</span><h2>{phase.name}</h2><p>{stat.done}/{stat.total} completed</p></div><span className="count">{stat.total}</span></div>
    <div className="cards">{board.tasks.filter(t=>t.phaseId===phase.id).sort(taskSort).map(task=><article draggable={canEditTask(task)} onDragStart={e=>{if(canEditTask(task))e.dataTransfer.setData('taskId',task.id);else e.preventDefault()}} onClick={()=>void openTask(task)} onKeyDown={e=>{if(e.key==='Enter'){void openTask(task)}}} role="button" tabIndex={0} className="card" key={task.id}>
      <div className="cardTop"><div className="taskTags"><span className={`status ${task.status.replaceAll(' ','').toLowerCase()}`}>◉ {task.status}</span><span className={`importance ${task.importance.replaceAll(' ','').toLowerCase()}`}>☆ {task.importance}</span><span className={`priority ${task.priority.toLowerCase()}`}>⚑ {task.priority}</span></div>{task.attachments.length>0&&<span className="attachmentCount">📎 {task.attachments.length}</span>}</div><h3>{task.title}</h3>{task.description&&<p>{task.description}</p>}
      <div className="people"><b>Owner:</b> {task.owner||'Unassigned'}{task.contributors.length>0&&<span> +{task.contributors.length} contributor{task.contributors.length>1?'s':''}</span>}</div>
      <div className="meta"><span className={`dueBadge ${dueWarning(task.dueDate,task.status)}`}>{task.dueDate?`Due ${task.dueDate}`:'No due date'}</span><span className="moveHint">View details →</span></div>
    </article>)}</div>
    {editable&&(newPhase===phase.id?<form className="quickAdd" onSubmit={e=>addTask(e,phase.id)}><input name="title" required autoFocus placeholder="Task title"/><div><button>Add</button><button type="button" className="ghost" onClick={()=>setNewPhase(null)}>Cancel</button></div></form>:<button className="addTask" onClick={()=>setNewPhase(phase.id)}>＋ Add task</button>)}
   </div>})}
  </section>
  {admin&&usersOpen&&access&&<UserManagement projectId={access.projectId} onClose={()=>setUsersOpen(false)} onChanged={()=>void refresh()}/>}
  {quickOpen && (
  <div
    className="overlay center"
    onMouseDown={() => setQuickOpen(false)}
  >
    <form
      className="quickModal"
      onMouseDown={(e) => e.stopPropagation()}
      onSubmit={quickAdd}
    >
      <div className="modalHead">
        <span>Quick Add</span>
        <button
          type="button"
          onClick={() => setQuickOpen(false)}
          aria-label="Close Quick Add"
        >
          ×
        </button>
      </div>

      <p>Capture it now. Organize it later.</p>

      <div className="quickAddField">
        <label className="quickAddLabel" htmlFor="quickTaskTitle">
          Task title
        </label>

        <input
          id="quickTaskTitle"
          name="title"
          autoFocus
          required
          placeholder="What's on your mind?"
        />
      </div>

      <div className="quickAddField">
        <span className="quickAddLabel">Project</span>

        <ProjectPicker
  value={newIdeaProject}
  onChange={setNewIdeaProject}
  options={projectNames.filter(
    (name) =>
      admin || !["Admin Task", "Personal"].includes(name)
  )}
/>
      </div>

      <button type="submit" className="wide">
        Add to Ideas / To-Do
      </button>
    </form>
  </div>
)} {selected&&<div className="overlay taskDialogOverlay" onMouseDown={()=>setSelected(null)}><section className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modalHead"><span>Task details</span><button onClick={()=>setSelected(null)}>×</button></div>
   {canEditTask(selected)&&<fieldset className="taskEditable"><label>Title<input value={selected.title} onChange={e=>setSelected({...selected,title:e.target.value})} onBlur={()=>void updateTask(selected)}/></label>
   <label>Description<textarea rows={4} value={selected.description} onChange={e=>setSelected({...selected,description:e.target.value})} onBlur={()=>void updateTask(selected)}/></label>
   <div className="grid2"><label>Status<select value={selected.status} onChange={e=>updateTask({...selected,status:e.target.value as Status})}>{statuses.map(x=><option key={x}>{x}</option>)}</select></label><label>Priority<select value={selected.priority} onChange={e=>updateTask({...selected,priority:e.target.value as Priority})}>{priorities.map(x=><option key={x}>{x}</option>)}</select></label></div>
   <label>Importance<select value={selected.importance} onChange={e=>updateTask({...selected,importance:e.target.value as Importance})}>{importanceOptions.map(x=><option key={x}>{x}</option>)}</select></label>
   <div className="grid2"><label>Task owner<input value={selected.owner} placeholder="One owner" onChange={e=>setSelected({...selected,owner:e.target.value})} onBlur={()=>void updateTask(selected)}/></label><label>Due date<input type="date" value={selected.dueDate} onChange={e=>updateTask({...selected,dueDate:e.target.value})}/></label></div>
   <ContributorsEditor key={selected.id} contributors={selected.contributors} members={members} onChange={contributors=>updateTask({...selected,contributors})}/>
   <label>Move to<select value={selected.phaseId} onChange={e=>updateTask({...selected,phaseId:e.target.value})}>{board.phases.filter(p=>admin||!['Admin Task','Personal'].includes(p.name)).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
   </fieldset>}
   {!canEditTask(selected)&&<section className="taskReadOnly" aria-label="Task details (view only)">
    <p className="taskReadOnlyNotice">View only · You can see all task details but cannot change them.</p>
    <div className="taskReadOnlyField"><strong>Title</strong><p>{selected.title}</p></div>
    <div className="taskReadOnlyField"><strong>Description</strong><p className="taskReadOnlyDescription">{selected.description||'—'}</p></div>
    <div className="grid2">
     <div className="taskReadOnlyField"><strong>Status</strong><p>{selected.status}</p></div>
     <div className="taskReadOnlyField"><strong>Priority</strong><p>{selected.priority}</p></div>
     <div className="taskReadOnlyField"><strong>Importance</strong><p>{selected.importance}</p></div>
     <div className="taskReadOnlyField"><strong>Task owner</strong><p>{selected.owner||'—'}</p></div>
     <div className="taskReadOnlyField"><strong>Due date</strong><p>{selected.dueDate||'—'}</p></div>
     <div className="taskReadOnlyField"><strong>Phase</strong><p>{board.phases.find(p=>p.id===selected.phaseId)?.name||'—'}</p></div>
    </div>
<div className="taskReadOnlyField">
  <strong>Contributors</strong>
  <p>
    {selected.contributors.length
      ? selected.contributors.map(getMemberName).join(', ')
      : '—'}
  </p>
</div>   </section>}
   <div className="attachmentSection"><div className="attachmentHeading"><strong>Image attachments</strong><small>Shared securely via Supabase</small></div>
    <div className="attachmentGrid">{selected.attachments.map(a=><AttachmentTile key={a.id} path={attachmentsPaths[a.id]} name={a.name} canRemove={canEditTask(selected)} onRemove={()=>void removeAttachment(a.id)}/>)}</div>
    {canEditTask(selected)&&<label className="uploadButton">＋ Add images<input aria-label="Add images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={uploading} onChange={e=>{void uploadImages(e.target.files);e.target.value='';}}/></label>}
    {uploading&&<p role="status">Saving images…</p>}{imageError&&<p className="imageError" role="alert">{imageError}</p>}
   </div>
   {admin&&<section className="permissionBox taskVisibility"><h3>🔒 Task permissions · Admin only</h3><p>{'Only Admins and the task creator can access this task by default. Grant view or edit individually.'} Viewers are always read-only.</p><button type="button" onClick={()=>void loadTaskGrants(selected.id)}>Refresh permissions</button><div>{members.filter(m=>m.role!=='admin'&&m.user_id!==selected.createdBy).map(m=><label key={m.user_id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:8}}><span>{m.display_name||m.email||m.user_id.slice(0,8)} ({m.role})</span><select aria-label={`Permission for ${m.display_name||m.email||m.user_id}`} value={taskGrants[selected.id]?.[m.user_id]||'none'} onChange={e=>void setTaskGrant(selected.id,m.user_id,e.target.value as 'none'|'view'|'edit')}><option value="none">No access</option><option value="view">View only</option>{m.role==='editor'&&<option value="edit">Can edit</option>}</select></label>)}</div></section>}
   <section className="discussion"><h3>Comments</h3>{comments.map(c=><div key={c.id} className="comment"><small>{c.author_id===access?.userId?'You':(members.find(m=>m.user_id===c.author_id)?.display_name||members.find(m=>m.user_id===c.author_id)?.email||'Member')} · {new Date(c.created_at).toLocaleString()}</small><p>{c.body}</p>{(admin||c.author_id===access?.userId)&&<button type="button" onClick={()=>void deleteComment(c.id)}>Delete comment</button>}</div>)}<label>Add comment<textarea rows={2} value={commentDraft} onChange={e=>setCommentDraft(e.target.value)}/></label><button type="button" disabled={!commentDraft.trim()} onClick={()=>void postComment()}>Post comment</button></section>
   <div className="modalActions">{canEditTask(selected)&&<button className="danger" onClick={()=>void removeTask(selected.id)}>Delete</button>}<button onClick={()=>setSelected(null)}>Done</button></div>
  </section></div>}
 </main>
}

function AttachmentTile({path,name,canRemove,onRemove}:{path?:string;name:string;canRemove:boolean;onRemove:()=>void}){
 const client=useMemo(()=>getSupabaseClient(),[]);const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{let alive=true;if(path)void client.storage.from('task-images').createSignedUrl(path,120).then(({data})=>{if(alive)setUrl(data?.signedUrl||null)});return()=>{alive=false}},[path,client]);
 return <div className="attachmentTile">{url?<a href={url} target="_blank" rel="noreferrer" aria-label={`View ${name}`}><img src={url} alt={name}/></a>:<div className="imagePlaceholder">Image unavailable</div>}<span title={name}>{name}</span>{canRemove&&<button type="button" aria-label={`Remove ${name}`} onClick={onRemove}>×</button>}</div>;
}

function ContributorsEditor({contributors,members,onChange}:{contributors:string[];members:{user_id:string;role:string;display_name?:string;email?:string}[];onChange:(ids:string[])=>void}){
 const [query,setQuery]=useState('');
 const [open,setOpen]=useState(false);
 const choices=members.filter(m=>!contributors.includes(m.user_id) && (m.display_name||m.email||m.user_id).toLowerCase().includes(query.toLowerCase()));
const label = (id: string) => {
  const member = members.find(m => m.user_id === id);

  return (
    member?.display_name?.trim() ||
    member?.email ||
    'Unknown user'
  );
}; return <div className="contributorsEditor">
  <label htmlFor="contributor-input">Contributors <span className="labelHint">(project members only)</span></label>
  <div className="contributorChips" aria-label="Selected contributors">{contributors.map((id,index)=><span className="contributorChip" key={`${id}-${index}`}>{label(id)}<button type="button" aria-label={`Remove ${label(id)}`} onClick={()=>onChange(contributors.filter((_,i)=>i!==index))}>×</button></span>)}</div>
  <div className="contributorPicker"><input id="contributor-input" autoComplete="off" value={query} placeholder="Search project members…" onChange={e=>{setQuery(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)} aria-expanded={open} aria-controls="contributor-options"/>
  {open&&<div id="contributor-options" className="contributorOptions" role="listbox">{choices.map(m=><button type="button" role="option" aria-selected={false} key={m.user_id} onClick={()=>{onChange([...contributors,m.user_id]);setQuery('');setOpen(false)}}>{m.display_name||m.email||m.user_id}<small>{m.email&&m.display_name?m.email:m.role}</small></button>)}{choices.length===0&&<p>No matching members</p>}</div>}</div>
  <p className="contributorHelp">Choose existing project members. Previously entered free-text contributors remain visible until removed.</p>
 </div>;
}
function ProjectPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const outside = (event: PointerEvent) => {
      if (
        root.current &&
        !root.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        root.current
          ?.querySelector<HTMLButtonElement>(
            ".projectPickerTrigger"
          )
          ?.focus();
      }
    };

    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);

    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="projectPicker" ref={root}>
      <button
        type="button"
        className={`projectPickerTrigger ${open ? "isOpen" : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Project: ${value}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={`projectPickerDot project-${value
            .toLowerCase()
            .replaceAll(" ", "-")}`}
        />
        <span>{value}</span>
        <span className="projectPickerChevron" aria-hidden="true">
          ⌄
        </span>
      </button>

      {open && (
        <div className="projectPickerMenu">
          {options.map((name) => (
            <button
              key={name}
              type="button"
              className={`projectPickerOption ${
                value === name ? "selected" : ""
              }`}
              aria-pressed={value === name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
            >
              <span
                className={`projectPickerDot project-${name
                  .toLowerCase()
                  .replaceAll(" ", "-")}`}
              />
              <span>{name}</span>
              {value === name && (
                <span
                  className="projectPickerCheck"
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
