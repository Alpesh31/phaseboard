'use client';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { seed } from '@/lib/seed';
import { BoardData, Priority, Status, Importance, Task } from '@/lib/types';
import { saveImage, loadImage, deleteImage } from '@/lib/image-store';

const STORAGE_KEY='phaseboard-v2';
const OLD_STORAGE_KEY='phaseboard-v1';
const statuses:Status[]=['Not Started','In Progress','Blocked','Completed'];
const priorities:Priority[]=['Low','Medium','High'];
const importanceOptions:Importance[]=['Must','Maybe','Mostly Not'];
const uid=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():Math.random().toString(36).slice(2,10);

function migrate(raw:any):BoardData{
 if(!raw?.tasks) return seed;
 const oldPhaseMap:Record<string,string>={planning:'phase-1',build:'phase-2',test:'phase-3',launch:'phase-4'};
 return {
  projectName:raw.projectName||seed.projectName,
  phases:seed.phases,
  tasks:raw.tasks.filter((t:any)=>!['phase-4','launch'].includes(t.phaseId)).map((t:any)=>({id:t.id||uid(),title:t.title||'Untitled',description:t.description||'',priority:t.priority||'Medium',importance:importanceOptions.includes(t.importance)?t.importance:'Maybe',attachments:Array.isArray(t.attachments)?t.attachments:[],status:t.status||'Not Started',owner:t.owner||t.assignee||'Me',contributors:Array.isArray(t.contributors)?t.contributors:[],dueDate:t.dueDate||'',phaseId:oldPhaseMap[t.phaseId]||t.phaseId||'ideas'}))
 };
}

export default function Home(){
 const boardRef=useRef<HTMLElement|null>(null); const touchStart=useRef<{x:number,y:number}|null>(null); const [activePhase,setActivePhase]=useState(0);
 const [board,setBoard]=useState<BoardData>(seed); const [ready,setReady]=useState(false);
 const [selected,setSelected]=useState<Task|null>(null); const [uploading,setUploading]=useState(false); const [imageError,setImageError]=useState(''); const [newPhase,setNewPhase]=useState<string|null>(null); const [quickOpen,setQuickOpen]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(OLD_STORAGE_KEY);if(saved)setBoard(migrate(JSON.parse(saved)))}catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)localStorage.setItem(STORAGE_KEY,JSON.stringify(board))},[board,ready]);
 const completed=board.tasks.filter(t=>t.status==='Completed').length;
 const progress=board.tasks.length?Math.round(completed/board.tasks.length*100):0;
 const updateTask=(task:Task)=>{setBoard(b=>({...b,tasks:b.tasks.map(t=>t.id===task.id?task:t)}));setSelected(task)};
 const removeTask=(id:string)=>{const task=board.tasks.find(t=>t.id===id);task?.attachments.forEach(a=>{void deleteImage(a.id).catch(console.error)});setBoard(b=>({...b,tasks:b.tasks.filter(t=>t.id!==id)}));setSelected(null)};
 const moveTask=(taskId:string,phaseId:string)=>setBoard(b=>({...b,tasks:b.tasks.map(t=>t.id===taskId?{...t,phaseId}:t)}));
 const createTask=(title:string,phaseId='ideas')=>setBoard(b=>({...b,tasks:[...b.tasks,{id:uid(),title,description:'',priority:'Medium',importance:'Maybe',attachments:[],status:'Not Started',owner:'Me',contributors:[],dueDate:'',phaseId}]}));
 const addTask=(e:FormEvent<HTMLFormElement>,phaseId:string)=>{e.preventDefault();const form=e.currentTarget;const title=String(new FormData(form).get('title')||'').trim();if(!title)return;createTask(title,phaseId);form.reset();setNewPhase(null)};
 const quickAdd=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=e.currentTarget;const title=String(new FormData(form).get('title')||'').trim();if(!title)return;createTask(title);form.reset();setQuickOpen(false)};
 const uploadImages=async (files:FileList|null)=>{
  if(!files||!selected)return;
  setUploading(true);setImageError('');
  const added:Task['attachments']=[];
  try {
   for(const file of Array.from(files)){
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('Use JPG, PNG, WebP or GIF images.');
    if(file.size>8*1024*1024)throw new Error('Each image must be 8 MB or smaller.');
    const id=uid();await saveImage(id,file);added.push({id,name:file.name,type:file.type,size:file.size});
   }
   updateTask({...selected,attachments:[...selected.attachments,...added]});
  }catch(err){setImageError(err instanceof Error?err.message:'Image upload failed.');}
  finally{setUploading(false);}
 };
 const removeAttachment=async(id:string)=>{
  if(!selected)return;
  try{await deleteImage(id);updateTask({...selected,attachments:selected.attachments.filter(a=>a.id!==id)});}catch{setImageError('Could not remove image.');}
 };
 const phaseStats=useMemo(()=>Object.fromEntries(board.phases.map(p=>{const list=board.tasks.filter(t=>t.phaseId===p.id);return[p.id,{done:list.filter(t=>t.status==='Completed').length,total:list.length}]})),[board]);
 if(!ready)return null;
 return <main>
  <header className="topbar"><div><div className="brand">Phaseboard</div><div className="tagline">Capture ideas. Turn them into action.</div></div><button className="quickButton" onClick={()=>setQuickOpen(true)}>＋ Quick Add</button></header>
  <section className="hero"><div><span className="eyebrow">PROJECT</span><input className="projectTitle" value={board.projectName} onChange={e=>setBoard({...board,projectName:e.target.value})}/><p className="heroHint">Add thoughts to Ideas / To-Do, then move them into a phase when you're ready.</p></div><div className="progressBox"><div><b>{progress}%</b> complete</div><div className="progress"><span style={{width:`${progress}%`}}/></div><small>{completed} of {board.tasks.length} items completed</small></div></section>
  <nav className="mobilePhases" aria-label="Choose phase">{board.phases.map((phase,index)=><button key={phase.id} type="button" className={activePhase===index?'active':''} aria-current={activePhase===index?'step':undefined} onClick={()=>setActivePhase(index)}>{phase.id==='ideas'?'Ideas':phase.name}</button>)}</nav>
  <section className="board" ref={boardRef} onTouchStart={e=>{if(window.innerWidth>700)return;const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{if(window.innerWidth>700||!touchStart.current)return;const t=e.changedTouches[0];const dx=t.clientX-touchStart.current.x;const dy=t.clientY-touchStart.current.y;touchStart.current=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4){setActivePhase(i=>Math.max(0,Math.min(board.phases.length-1,i+(dx<0?1:-1))));}}}>
   {board.phases.map((phase,index)=>{const stat=phaseStats[phase.id];const isIdeas=phase.id==='ideas';return <div data-mobile-active={activePhase===index} className={`column ${isIdeas?'ideasColumn':''}`} key={phase.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData('taskId');if(id)moveTask(id,phase.id)}}>
    <div className="columnHead"><div><span className="phaseNum">{isIdeas?'INBOX':`PHASE ${index}`}</span><h2>{phase.name}</h2><p>{stat.done}/{stat.total} completed</p></div><span className="count">{stat.total}</span></div>
    <div className="cards">{board.tasks.filter(t=>t.phaseId===phase.id).map(task=><article draggable onDragStart={e=>e.dataTransfer.setData('taskId',task.id)} onClick={()=>setSelected(task)} className="card" key={task.id}>
      <div className="cardTop"><div className="taskTags"><span className={`status ${task.status.replaceAll(' ','').toLowerCase()}`}>{task.status}</span><span className={`importance ${task.importance.replaceAll(' ','').toLowerCase()}`}>{task.importance}</span><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span></div>{task.attachments.length>0&&<span className="attachmentCount">📎 {task.attachments.length}</span>}</div><h3>{task.title}</h3>{task.description&&<p>{task.description}</p>}
      <div className="people"><b>Owner:</b> {task.owner||'Unassigned'}{task.contributors.length>0&&<span> +{task.contributors.length} contributor{task.contributors.length>1?'s':''}</span>}</div>
      <div className="meta"><span>{task.dueDate?`Due ${task.dueDate}`:'No due date'}</span><span className="moveHint">Tap to edit →</span></div>
    </article>)}</div>
    {newPhase===phase.id?<form className="quickAdd" onSubmit={e=>addTask(e,phase.id)}><input name="title" autoFocus placeholder={isIdeas?'Capture an idea...':'Task title'}/><div><button>Add</button><button type="button" className="ghost" onClick={()=>setNewPhase(null)}>Cancel</button></div></form>:<button className="addTask" onClick={()=>setNewPhase(phase.id)}>＋ {isIdeas?'Add idea / to-do':'Add task'}</button>}
   </div>})}
  </section>
  {quickOpen&&<div className="overlay center" onMouseDown={()=>setQuickOpen(false)}><form className="quickModal" onMouseDown={e=>e.stopPropagation()} onSubmit={quickAdd}><div className="modalHead"><span>Quick Add</span><button type="button" onClick={()=>setQuickOpen(false)}>×</button></div><p>Capture it now. Organize it later.</p><input name="title" autoFocus placeholder="What's on your mind?"/><button className="wide">Add to Ideas / To-Do</button></form></div>}
  {selected&&<div className="overlay" onMouseDown={()=>setSelected(null)}><section className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modalHead"><span>Task details</span><button onClick={()=>setSelected(null)}>×</button></div>
   <label>Title<input value={selected.title} onChange={e=>updateTask({...selected,title:e.target.value})}/></label>
   <label>Description<textarea rows={4} value={selected.description} onChange={e=>updateTask({...selected,description:e.target.value})}/></label>
   <div className="grid2"><label>Status<select value={selected.status} onChange={e=>updateTask({...selected,status:e.target.value as Status})}>{statuses.map(x=><option key={x}>{x}</option>)}</select></label><label>Priority<select value={selected.priority} onChange={e=>updateTask({...selected,priority:e.target.value as Priority})}>{priorities.map(x=><option key={x}>{x}</option>)}</select></label></div>
   <label>Importance<select value={selected.importance} onChange={e=>updateTask({...selected,importance:e.target.value as Importance})}>{importanceOptions.map(x=><option key={x}>{x}</option>)}</select></label>
   <div className="grid2"><label>Task owner<input value={selected.owner} placeholder="One owner" onChange={e=>updateTask({...selected,owner:e.target.value})}/></label><label>Due date<input type="date" value={selected.dueDate} onChange={e=>updateTask({...selected,dueDate:e.target.value})}/></label></div>
   <ContributorsEditor key={selected.id} contributors={selected.contributors} onChange={contributors=>updateTask({...selected,contributors})}/>
   <label>Move to<select value={selected.phaseId} onChange={e=>updateTask({...selected,phaseId:e.target.value})}>{board.phases.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
   <div className="attachmentSection"><div className="attachmentHeading"><strong>Image attachments</strong><small>Stored on this device only</small></div>
    <div className="attachmentGrid">{selected.attachments.map(a=><AttachmentTile key={a.id} id={a.id} name={a.name} onRemove={()=>void removeAttachment(a.id)}/>)}</div>
    <label className="uploadButton">＋ Add images<input aria-label="Add images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={uploading} onChange={e=>{void uploadImages(e.target.files);e.target.value='';}}/></label>
    {uploading&&<p role="status">Saving images…</p>}{imageError&&<p className="imageError" role="alert">{imageError}</p>}
   </div>
   <div className="modalActions"><button className="danger" onClick={()=>removeTask(selected.id)}>Delete</button><button onClick={()=>setSelected(null)}>Done</button></div>
  </section></div>}
 </main>
}

function AttachmentTile({id,name,onRemove}:{id:string;name:string;onRemove:()=>void}){
 const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{let active=true;let objectUrl:string|null=null;
  void loadImage(id).then(blob=>{if(active&&blob){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(console.error);
  return ()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[id]);
 return <div className="attachmentTile">{url?<a href={url} target="_blank" rel="noreferrer" aria-label={`View ${name}`}><img src={url} alt={name}/></a>:<div className="imagePlaceholder">Image unavailable</div>}<span title={name}>{name}</span><button type="button" aria-label={`Remove ${name}`} onClick={onRemove}>×</button></div>;
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
