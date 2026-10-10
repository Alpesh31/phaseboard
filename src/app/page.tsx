'use client';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BoardData, Priority, Status, Importance, Task } from '@/lib/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAccess } from '@/components/auth-shell';

const statuses:Status[]=['Not Started','In Progress','Blocked','Completed'];
const priorities:Priority[]=['Low','Medium','High'];
const importanceOptions:Importance[]=['Must','Maybe','Mostly Not'];
const uid=()=>crypto.randomUUID();
type DbTask = {id:string;title:string;description:string;priority:Priority;status:Status;importance:Importance;owner_name:string;due_date:string|null;phase_id:string;visible_to_everyone:boolean;task_contributors:{name:string}[];task_attachments:{id:string;filename:string;content_type:string;bytes:number;storage_path:string}[]};
const convertTask=(t:DbTask):Task=>({id:t.id,title:t.title,description:t.description,priority:t.priority,status:t.status,importance:t.importance,owner:t.owner_name,contributors:(t.task_contributors||[]).map(c=>c.name),dueDate:t.due_date||'',phaseId:t.phase_id,attachments:(t.task_attachments||[]).map(a=>({id:a.id,name:a.filename,type:a.content_type,size:a.bytes}))});

export default function Home(){
 const boardRef=useRef<HTMLElement|null>(null); const touchStart=useRef<{x:number,y:number}|null>(null); const [activePhase,setActivePhase]=useState(0);
 const access=useAccess(); const client=useMemo(()=>getSupabaseClient(),[]);
 const [board,setBoard]=useState<BoardData>({projectName:'Phaseboard',phases:[],tasks:[]});
 const [ready,setReady]=useState(false); const [error,setError]=useState('');
 const [selected,setSelected]=useState<Task|null>(null); const [uploading,setUploading]=useState(false); const [imageError,setImageError]=useState(''); const [newPhase,setNewPhase]=useState<string|null>(null); const [quickOpen,setQuickOpen]=useState(false);
 const [visibility,setVisibility]=useState<Record<string,boolean>>({});
 const [allowed,setAllowed]=useState<Record<string,string[]>>({});
 const [members,setMembers]=useState<{user_id:string;role:string}[]>([]);
 const [comments,setComments]=useState<{id:string;author_id:string;body:string;created_at:string}[]>([]);
 const [commentDraft,setCommentDraft]=useState('');
 const [attachmentsPaths,setAttachmentsPaths]=useState<Record<string,string>>({});
 const editable=access?.role==='admin'||access?.role==='editor';
 const admin=access?.role==='admin';
 const refresh=async()=>{
  if(!access)return;
  const [ph,ts,pr,mem]=await Promise.all([
   client.from('phases').select('id,name,visible_to_everyone').eq('project_id',access.projectId).order('position'),
   client.from('tasks').select('id,title,description,priority,status,importance,owner_name,due_date,phase_id,visible_to_everyone,task_contributors(name),task_attachments(id,filename,content_type,bytes,storage_path)').eq('project_id',access.projectId).order('created_at'),
   client.from('projects').select('name').eq('id',access.projectId).single(),
   client.from('project_members').select('user_id,role').eq('project_id',access.projectId)
  ]);
  const failure=ph.error||ts.error||pr.error||mem.error;
  if(failure){setError(failure.message);setReady(true);return;}
  setError('');setMembers(mem.data||[]);
  setBoard({projectName:pr.data?.name||'Phaseboard',phases:(ph.data||[]).map(p=>({id:p.id,name:p.name})),tasks:((ts.data||[]) as unknown as DbTask[]).map(convertTask)});
  setVisibility(Object.fromEntries([...(ph.data||[]).map(p=>[p.id,p.visible_to_everyone]),...(ts.data||[]).map(t=>[t.id,t.visible_to_everyone])]));
  setAttachmentsPaths(Object.fromEntries((ts.data||[]).flatMap(t=>(t.task_attachments||[]).map(a=>[a.id,a.storage_path]))));
  setReady(true);
 };
 useEffect(()=>{void refresh();},[access?.projectId]);
 useEffect(()=>{if(!access)return;const channel=client.channel('phaseboard-'+access.projectId)
  .on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:`project_id=eq.${access.projectId}`},()=>{void refresh()})
  .on('postgres_changes',{event:'*',schema:'public',table:'phases',filter:`project_id=eq.${access.projectId}`},()=>{void refresh()})
  .subscribe();return()=>{void client.removeChannel(channel)}},[access?.projectId]);
 const completed=board.tasks.filter(t=>t.status==='Completed').length;
 const progress=board.tasks.length?Math.round(completed/board.tasks.length*100):0;
 const fail=(e:unknown)=>setError(e instanceof Error?e.message:String(e));
 const updateTask=async(task:Task)=>{
  if(!editable)return;
  setSelected(task);
  const {error:e}=await client.from('tasks').update({title:task.title,description:task.description,status:task.status,priority:task.priority,importance:task.importance,owner_name:task.owner,due_date:task.dueDate||null,phase_id:task.phaseId}).eq('id',task.id);
  if(e){fail(e);return;}
  const current=board.tasks.find(t=>t.id===task.id);
  if(JSON.stringify(current?.contributors)!==JSON.stringify(task.contributors)){
   const {error:delErr}=await client.from('task_contributors').delete().eq('task_id',task.id);
   if(delErr){fail(delErr);return;}
   if(task.contributors.length){const {error:insErr}=await client.from('task_contributors').insert(task.contributors.map(name=>({task_id:task.id,name})));if(insErr)fail(insErr);}
  }
  await refresh();
 };
 const removeTask=async(id:string)=>{if(!editable)return;const {error:e}=await client.from('tasks').delete().eq('id',id);if(e)fail(e);else{setSelected(null);await refresh();}};
 const moveTask=async(taskId:string,phaseId:string)=>{if(!editable)return;const {error:e}=await client.from('tasks').update({phase_id:phaseId}).eq('id',taskId);if(e)fail(e);else await refresh();};
 const createTask=async(title:string,phaseId?:string)=>{if(!access||!editable)return;const dest=phaseId||board.phases[0]?.id;if(!dest)return;const {error:e}=await client.from('tasks').insert({project_id:access.projectId,phase_id:dest,title,created_by:access.userId});if(e)fail(e);else await refresh();};
 const addTask=(e:FormEvent<HTMLFormElement>,phaseId:string)=>{e.preventDefault();const form=e.currentTarget;const title=String(new FormData(form).get('title')||'').trim();if(!title)return;void createTask(title,phaseId);form.reset();setNewPhase(null)};
 const quickAdd=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=e.currentTarget;const title=String(new FormData(form).get('title')||'').trim();if(!title)return;void createTask(title);form.reset();setQuickOpen(false)};
 const uploadImages=async(files:FileList|null)=>{
  if(!files||!selected||!access||!editable)return;
  setUploading(true);setImageError('');
  try {for(const file of Array.from(files)){
   if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('Use JPG, PNG, WebP or GIF images.');
   if(file.size>8*1024*1024)throw new Error('Each image must be 8 MB or smaller.');
   const path=`${access.projectId}/${selected.id}/${uid()}`;
   const {error:upErr}=await client.storage.from('task-images').upload(path,file,{contentType:file.type});if(upErr)throw upErr;
   const {error:metaErr}=await client.from('task_attachments').insert({task_id:selected.id,storage_path:path,filename:file.name,content_type:file.type,bytes:file.size,created_by:access.userId});
   if(metaErr){await client.storage.from('task-images').remove([path]);throw metaErr;}
  }await refresh();const {data}=await client.from('tasks').select('id,title,description,priority,status,importance,owner_name,due_date,phase_id,task_contributors(name),task_attachments(id,filename,content_type,bytes,storage_path)').eq('id',selected.id).single();if(data)setSelected(convertTask(data as unknown as DbTask));
  }catch(e){setImageError(e instanceof Error?e.message:'Image upload failed.')}finally{setUploading(false)}
 };
 const removeAttachment=async(id:string)=>{if(!selected||!editable)return;const path=attachmentsPaths[id];const {error:e}=await client.from('task_attachments').delete().eq('id',id);if(e){fail(e);return;}if(path)await client.storage.from('task-images').remove([path]);setSelected({...selected,attachments:selected.attachments.filter(a=>a.id!==id)});await refresh();};
 const openTask=async(task:Task)=>{setSelected(task);setComments([]);setCommentDraft('');const {data,error:e}=await client.from('comments').select('id,author_id,body,created_at').eq('task_id',task.id).order('created_at');if(e)fail(e);else setComments(data||[])};
 const postComment=async()=>{if(!access||!selected||!commentDraft.trim())return;const {error:e}=await client.from('comments').insert({task_id:selected.id,author_id:access.userId,body:commentDraft.trim()});if(e){fail(e);return;}setCommentDraft('');void openTask(selected)};
 const deleteComment=async(id:string)=>{const {error:e}=await client.from('comments').delete().eq('id',id);if(e)fail(e);else if(selected)void openTask(selected)};
 const changeVisibility=async(type:'phase'|'task',id:string,value:boolean)=>{if(!admin)return;const {error:e}=await client.from(type==='phase'?'phases':'tasks').update({visible_to_everyone:value}).eq('id',id);if(e)fail(e);else await refresh();};
 const changeAccess=async(type:'phase'|'task',id:string,userId:string,enabled:boolean)=>{if(!admin)return;const table=type==='phase'?'phase_access':'task_access';const field=type==='phase'?'phase_id':'task_id';const query=enabled?client.from(table).insert({[field]:id,user_id:userId}):client.from(table).delete().eq(field,id).eq('user_id',userId);const {error:e}=await query;if(e)fail(e);else await loadAccess(type,id);};
 const loadAccess=async(type:'phase'|'task',id:string)=>{const table=type==='phase'?'phase_access':'task_access';const field=type==='phase'?'phase_id':'task_id';const {data,error:e}=await client.from(table).select('user_id').eq(field,id);if(e)fail(e);else setAllowed(old=>({...old,[id]:(data||[]).map(x=>x.user_id)}));};
 const phaseStats=useMemo(()=>Object.fromEntries(board.phases.map(p=>{const list=board.tasks.filter(t=>t.phaseId===p.id);return[p.id,{done:list.filter(t=>t.status==='Completed').length,total:list.length}]})),[board]);
 if(!ready)return <main><p role='status'>Loading shared Phaseboard…</p></main>;
 return <main>
  {error&&<p role="alert" className="imageError">{error} <button onClick={()=>void refresh()}>Retry</button></p>}
  <header className="topbar"><div><div className="brand">Phaseboard</div><div className="tagline">Capture ideas. Turn them into action.</div></div>{editable&&<button className="quickButton" onClick={()=>setQuickOpen(true)}>＋ Quick Add</button>}</header>
  <section className="hero"><div><span className="eyebrow">PROJECT</span><h1 className="projectTitle">{board.projectName}</h1><p className="heroHint">Add thoughts to Ideas / To-Do, then move them into a phase when you're ready.</p></div><div className="progressBox"><div><b>{progress}%</b> complete</div><div className="progress"><span style={{width:`${progress}%`}}/></div><small>{completed} of {board.tasks.length} items completed</small></div></section>
  <nav className="mobilePhases" aria-label="Choose phase">{board.phases.map((phase,index)=><button key={phase.id} type="button" className={activePhase===index?'active':''} aria-current={activePhase===index?'step':undefined} onClick={()=>setActivePhase(index)}>{phase.id==='ideas'?'Ideas':phase.name}</button>)}</nav>
  <section className="board" ref={boardRef} onTouchStart={e=>{if(window.innerWidth>700)return;const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{if(window.innerWidth>700||!touchStart.current)return;const t=e.changedTouches[0];const dx=t.clientX-touchStart.current.x;const dy=t.clientY-touchStart.current.y;touchStart.current=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4){setActivePhase(i=>Math.max(0,Math.min(board.phases.length-1,i+(dx<0?1:-1))));}}}>
   {board.phases.map((phase,index)=>{const stat=phaseStats[phase.id];const isIdeas=phase.id==='ideas';return <div data-mobile-active={activePhase===index} className={`column ${isIdeas?'ideasColumn':''}`} key={phase.id} onDragOver={e=>{if(editable)e.preventDefault()}} onDrop={e=>{const id=e.dataTransfer.getData('taskId');if(id&&editable)void moveTask(id,phase.id)}}>
    <div className="columnHead"><div><span className="phaseNum">{isIdeas?'INBOX':`PHASE ${index}`}</span><h2>{phase.name}</h2><p>{stat.done}/{stat.total} completed</p></div><span className="count">{stat.total}</span></div>
    {admin&&<details className="permissionBox"><summary>Phase visibility</summary><label><input type="checkbox" checked={visibility[phase.id]??true} onChange={e=>void changeVisibility('phase',phase.id,e.target.checked)}/> Visible to everyone</label>{!visibility[phase.id]&&<div><button onClick={()=>void loadAccess('phase',phase.id)}>Manage selected users</button>{(allowed[phase.id]||[]).length>=0&&members.filter(m=>m.role!=='admin').map(m=><label key={m.user_id}><input type="checkbox" checked={(allowed[phase.id]||[]).includes(m.user_id)} onChange={e=>void changeAccess('phase',phase.id,m.user_id,e.target.checked)}/>{m.user_id.slice(0,8)} ({m.role})</label>)}</div>}</details>}
    <div className="cards">{board.tasks.filter(t=>t.phaseId===phase.id).map(task=><article draggable={editable} onDragStart={e=>e.dataTransfer.setData('taskId',task.id)} onClick={()=>void openTask(task)} className="card" key={task.id}>
      <div className="cardTop"><div className="taskTags"><span className={`status ${task.status.replaceAll(' ','').toLowerCase()}`}>{task.status}</span><span className={`importance ${task.importance.replaceAll(' ','').toLowerCase()}`}>{task.importance}</span><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span></div>{task.attachments.length>0&&<span className="attachmentCount">📎 {task.attachments.length}</span>}</div><h3>{task.title}</h3>{task.description&&<p>{task.description}</p>}
      <div className="people"><b>Owner:</b> {task.owner||'Unassigned'}{task.contributors.length>0&&<span> +{task.contributors.length} contributor{task.contributors.length>1?'s':''}</span>}</div>
      <div className="meta"><span>{task.dueDate?`Due ${task.dueDate}`:'No due date'}</span><span className="moveHint">Tap to edit →</span></div>
    </article>)}</div>
    {editable&&(newPhase===phase.id?<form className="quickAdd" onSubmit={e=>addTask(e,phase.id)}><input name="title" autoFocus placeholder={isIdeas?'Capture an idea...':'Task title'}/><div><button>Add</button><button type="button" className="ghost" onClick={()=>setNewPhase(null)}>Cancel</button></div></form>:<button className="addTask" onClick={()=>setNewPhase(phase.id)}>＋ {isIdeas?'Add idea / to-do':'Add task'}</button>)}
   </div>})}
  </section>
  {quickOpen&&<div className="overlay center" onMouseDown={()=>setQuickOpen(false)}><form className="quickModal" onMouseDown={e=>e.stopPropagation()} onSubmit={quickAdd}><div className="modalHead"><span>Quick Add</span><button type="button" onClick={()=>setQuickOpen(false)}>×</button></div><p>Capture it now. Organize it later.</p><input name="title" autoFocus placeholder="What's on your mind?"/><button className="wide">Add to Ideas / To-Do</button></form></div>}
  {selected&&<div className="overlay" onMouseDown={()=>setSelected(null)}><section className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modalHead"><span>Task details</span><button onClick={()=>setSelected(null)}>×</button></div>
   {editable&&<fieldset className="taskEditable"><label>Title<input value={selected.title} onChange={e=>setSelected({...selected,title:e.target.value})} onBlur={()=>void updateTask(selected)}/></label>
   <label>Description<textarea rows={4} value={selected.description} onChange={e=>setSelected({...selected,description:e.target.value})} onBlur={()=>void updateTask(selected)}/></label>
   <div className="grid2"><label>Status<select value={selected.status} onChange={e=>updateTask({...selected,status:e.target.value as Status})}>{statuses.map(x=><option key={x}>{x}</option>)}</select></label><label>Priority<select value={selected.priority} onChange={e=>updateTask({...selected,priority:e.target.value as Priority})}>{priorities.map(x=><option key={x}>{x}</option>)}</select></label></div>
   <label>Importance<select value={selected.importance} onChange={e=>updateTask({...selected,importance:e.target.value as Importance})}>{importanceOptions.map(x=><option key={x}>{x}</option>)}</select></label>
   <div className="grid2"><label>Task owner<input value={selected.owner} placeholder="One owner" onChange={e=>setSelected({...selected,owner:e.target.value})} onBlur={()=>void updateTask(selected)}/></label><label>Due date<input type="date" value={selected.dueDate} onChange={e=>updateTask({...selected,dueDate:e.target.value})}/></label></div>
   <ContributorsEditor key={selected.id} contributors={selected.contributors} onChange={contributors=>updateTask({...selected,contributors})}/>
   <label>Move to<select value={selected.phaseId} onChange={e=>updateTask({...selected,phaseId:e.target.value})}>{board.phases.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
   </fieldset>}
   <div className="attachmentSection"><div className="attachmentHeading"><strong>Image attachments</strong><small>Shared securely via Supabase</small></div>
    <div className="attachmentGrid">{selected.attachments.map(a=><AttachmentTile key={a.id} path={attachmentsPaths[a.id]} name={a.name} canRemove={editable} onRemove={()=>void removeAttachment(a.id)}/>)}</div>
    {editable&&<label className="uploadButton">＋ Add images<input aria-label="Add images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={uploading} onChange={e=>{void uploadImages(e.target.files);e.target.value='';}}/></label>}
    {uploading&&<p role="status">Saving images…</p>}{imageError&&<p className="imageError" role="alert">{imageError}</p>}
   </div>
   {admin&&<details className="permissionBox"><summary>Task visibility</summary><label><input type="checkbox" checked={visibility[selected.id]??true} onChange={e=>void changeVisibility('task',selected.id,e.target.checked)}/> Visible to everyone with phase access</label>{!visibility[selected.id]&&<div><button onClick={()=>void loadAccess('task',selected.id)}>Manage selected users</button>{members.filter(m=>m.role!=='admin').map(m=><label key={m.user_id}><input type="checkbox" checked={(allowed[selected.id]||[]).includes(m.user_id)} onChange={e=>void changeAccess('task',selected.id,m.user_id,e.target.checked)}/>{m.user_id.slice(0,8)} ({m.role})</label>)}</div>}</details>}
   <section className="discussion"><h3>Comments</h3>{comments.map(c=><div key={c.id} className="comment"><small>{c.author_id===access?.userId?'You':c.author_id.slice(0,8)} · {new Date(c.created_at).toLocaleString()}</small><p>{c.body}</p>{(admin||c.author_id===access?.userId)&&<button type="button" onClick={()=>void deleteComment(c.id)}>Delete comment</button>}</div>)}<label>Add comment<textarea rows={2} value={commentDraft} onChange={e=>setCommentDraft(e.target.value)}/></label><button type="button" disabled={!commentDraft.trim()} onClick={()=>void postComment()}>Post comment</button></section>
   <div className="modalActions">{editable&&<button className="danger" onClick={()=>void removeTask(selected.id)}>Delete</button>}<button onClick={()=>setSelected(null)}>Done</button></div>
  </section></div>}
 </main>
}

function AttachmentTile({path,name,canRemove,onRemove}:{path?:string;name:string;canRemove:boolean;onRemove:()=>void}){
 const client=useMemo(()=>getSupabaseClient(),[]);const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{let alive=true;if(path)void client.storage.from('task-images').createSignedUrl(path,120).then(({data})=>{if(alive)setUrl(data?.signedUrl||null)});return()=>{alive=false}},[path,client]);
 return <div className="attachmentTile">{url?<a href={url} target="_blank" rel="noreferrer" aria-label={`View ${name}`}><img src={url} alt={name}/></a>:<div className="imagePlaceholder">Image unavailable</div>}<span title={name}>{name}</span>{canRemove&&<button type="button" aria-label={`Remove ${name}`} onClick={onRemove}>×</button>}</div>;
}

function ContributorsEditor({contributors,onChange}:{contributors:string[];onChange:(names:string[])=>void}){
 const [draft,setDraft]=useState('');
 const add=()=>{
  const names=draft.split(',').map(n=>n.trim()).filter(Boolean);
  if(!names.length)return;
  const seen=new Set(contributors.map(n=>n.toLocaleLowerCase()));
  const next=[...contributors];
  for(const name of names){if(!seen.has(name.toLocaleLowerCase())){next.push(name);seen.add(name.toLocaleLowerCase());}}
  onChange(next);setDraft('');
 };
 return <div className="contributorsEditor">
  <label htmlFor="contributor-input">Contributors <span className="labelHint">(add multiple people)</span></label>
  <div className="contributorInputRow"><input id="contributor-input" value={draft} placeholder="Enter a name" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}}/><button type="button" onClick={add} disabled={!draft.trim()}>Add</button></div>
  <div className="contributorChips" aria-label="Contributors">{contributors.map((name,index)=><span className="contributorChip" key={`${name}-${index}`}>{name}<button type="button" aria-label={`Remove ${name}`} onClick={()=>onChange(contributors.filter((_,i)=>i!==index))}>×</button></span>)}</div>
  <p className="contributorHelp">Add one name at a time, or separate several names with commas. Press Enter or Add.</p>
 </div>;
}
