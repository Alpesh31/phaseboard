'use client';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { seed } from '@/lib/seed';
import { BoardData, Priority, Status, Task } from '@/lib/types';

const STORAGE_KEY='phaseboard-v2';
const OLD_STORAGE_KEY='phaseboard-v1';
const statuses:Status[]=['Not Started','In Progress','Blocked','Completed'];
const priorities:Priority[]=['Low','Medium','High'];
const uid=()=>Math.random().toString(36).slice(2,10);

function migrate(raw:any):BoardData{
 if(!raw?.tasks) return seed;
 const oldPhaseMap:Record<string,string>={planning:'phase-1',build:'phase-2',test:'phase-3',launch:'phase-4'};
 return {
  projectName:raw.projectName||seed.projectName,
  phases:seed.phases,
  tasks:raw.tasks.map((t:any)=>({id:t.id||uid(),title:t.title||'Untitled',description:t.description||'',priority:t.priority||'Medium',status:t.status||'Not Started',owner:t.owner||t.assignee||'Me',contributors:Array.isArray(t.contributors)?t.contributors:[],dueDate:t.dueDate||'',phaseId:oldPhaseMap[t.phaseId]||t.phaseId||'ideas'}))
 };
}

export default function Home(){
 const boardRef=useRef<HTMLElement|null>(null); const [activePhase,setActivePhase]=useState(0);
 const [board,setBoard]=useState<BoardData>(seed); const [ready,setReady]=useState(false);
 const [selected,setSelected]=useState<Task|null>(null); const [newPhase,setNewPhase]=useState<string|null>(null); const [quickOpen,setQuickOpen]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(OLD_STORAGE_KEY);if(saved)setBoard(migrate(JSON.parse(saved)))}catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)localStorage.setItem(STORAGE_KEY,JSON.stringify(board))},[board,ready]);
 const completed=board.tasks.filter(t=>t.status==='Completed').length;
 const progress=board.tasks.length?Math.round(completed/board.tasks.length*100):0;
 const updateTask=(task:Task)=>{setBoard(b=>({...b,tasks:b.tasks.map(t=>t.id===task.id?task:t)}));setSelected(task)};
 const removeTask=(id:string)=>{setBoard(b=>({...b,tasks:b.tasks.filter(t=>t.id!==id)}));setSelected(null)};
 const moveTask=(taskId:string,phaseId:string)=>setBoard(b=>({...b,tasks:b.tasks.map(t=>t.id===taskId?{...t,phaseId}:t)}));
 const createTask=(title:string,phaseId='ideas')=>setBoard(b=>({...b,tasks:[...b.tasks,{id:uid(),title,description:'',priority:'Medium',status:'Not Started',owner:'Me',contributors:[],dueDate:'',phaseId}]}));
 const addTask=(e:FormEvent<HTMLFormElement>,phaseId:string)=>{e.preventDefault();const form=e.currentTarget;const title=String(new FormData(form).get('title')||'').trim();if(!title)return;createTask(title,phaseId);form.reset();setNewPhase(null)};
 const quickAdd=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=e.currentTarget;const title=String(new FormData(form).get('title')||'').trim();if(!title)return;createTask(title);form.reset();setQuickOpen(false)};
 const phaseStats=useMemo(()=>Object.fromEntries(board.phases.map(p=>{const list=board.tasks.filter(t=>t.phaseId===p.id);return[p.id,{done:list.filter(t=>t.status==='Completed').length,total:list.length}]})),[board]);
 if(!ready)return null;
 return <main>
  <header className="topbar"><div><div className="brand">Phaseboard</div><div className="tagline">Capture ideas. Turn them into action.</div></div><button className="quickButton" onClick={()=>setQuickOpen(true)}>＋ Quick Add</button></header>
  <section className="hero"><div><span className="eyebrow">PROJECT</span><input className="projectTitle" value={board.projectName} onChange={e=>setBoard({...board,projectName:e.target.value})}/><p className="heroHint">Add thoughts to Ideas / To-Do, then move them into a phase when you're ready.</p></div><div className="progressBox"><div><b>{progress}%</b> complete</div><div className="progress"><span style={{width:`${progress}%`}}/></div><small>{completed} of {board.tasks.length} items completed</small></div></section>
  <nav className="mobilePhases" aria-label="Choose phase">{board.phases.map((phase,index)=><button key={phase.id} type="button" className={activePhase===index?'active':''} aria-current={activePhase===index?'step':undefined} onClick={()=>{setActivePhase(index);const el=boardRef.current;const col=el?.children[index] as HTMLElement|undefined;if(el&&col)el.scrollTo({left:col.offsetLeft-el.offsetLeft,behavior:'smooth'});}}>{phase.id==='ideas'?'Ideas':phase.name}</button>)}</nav>
  <section className="board" ref={boardRef} onScroll={e=>{if(window.innerWidth>700)return;const el=e.currentTarget;const index=Math.round(el.scrollLeft/Math.max(1,el.clientWidth));setActivePhase(Math.min(board.phases.length-1,Math.max(0,index)));}}>
   {board.phases.map((phase,index)=>{const stat=phaseStats[phase.id];const isIdeas=phase.id==='ideas';return <div className={`column ${isIdeas?'ideasColumn':''}`} key={phase.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData('taskId');if(id)moveTask(id,phase.id)}}>
    <div className="columnHead"><div><span className="phaseNum">{isIdeas?'INBOX':`PHASE ${index}`}</span><h2>{phase.name}</h2><p>{stat.done}/{stat.total} completed</p></div><span className="count">{stat.total}</span></div>
    <div className="cards">{board.tasks.filter(t=>t.phaseId===phase.id).map(task=><article draggable onDragStart={e=>e.dataTransfer.setData('taskId',task.id)} onClick={()=>setSelected(task)} className="card" key={task.id}>
      <div className="cardTop"><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span><span className={`status ${task.status.replaceAll(' ','').toLowerCase()}`}>{task.status}</span></div>
      <h3>{task.title}</h3>{task.description&&<p>{task.description}</p>}
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
   <div className="grid2"><label>Task owner<input value={selected.owner} placeholder="One owner" onChange={e=>updateTask({...selected,owner:e.target.value})}/></label><label>Due date<input type="date" value={selected.dueDate} onChange={e=>updateTask({...selected,dueDate:e.target.value})}/></label></div>
   <label>Contributors <span className="labelHint">(separate names with commas)</span><input value={selected.contributors.join(', ')} placeholder="Alex, Sam, Priya" onChange={e=>updateTask({...selected,contributors:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label>
   <label>Move to<select value={selected.phaseId} onChange={e=>updateTask({...selected,phaseId:e.target.value})}>{board.phases.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
   <div className="modalActions"><button className="danger" onClick={()=>removeTask(selected.id)}>Delete</button><button onClick={()=>setSelected(null)}>Done</button></div>
  </section></div>}
 </main>
}
