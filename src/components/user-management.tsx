'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

type Role = 'admin'|'editor'|'viewer';
type Member = {user_id:string;role:Role;email:string;display_name:string};
export default function UserManagement({projectId,onClose,onChanged}:{projectId:string;onClose:()=>void;onChanged:()=>void}) {
 const client=useMemo(()=>getSupabaseClient(),[]);
 const [members,setMembers]=useState<Member[]>([]);
 const [email,setEmail]=useState('');const [role,setRole]=useState<'editor'|'viewer'>('viewer');
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const call=useCallback(async(method:'GET'|'POST'|'PATCH'|'DELETE',body?:Record<string,string>)=>{
  const {data:{session}}=await client.auth.getSession();if(!session)throw new Error('Session expired. Sign in again.');
  const url='/api/admin/members?projectId='+encodeURIComponent(projectId);
  const res=await fetch(url,{method,headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({projectId,...body})}:{}) ,cache:'no-store'});
  const data=await res.json().catch(()=>({error:'Invalid server response'}));if(!res.ok)throw new Error(data.error||'Request failed');return data;
 },[client,projectId]);
 const reload=useCallback(async()=>{setLoading(true);setError('');try{const data=await call('GET');setMembers(data.members||[]);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}},[call]);
 useEffect(()=>{void reload();},[reload]);
 const invite=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');setNotice('');try{await call('POST',{email:email.trim(),role});setEmail('');setNotice('Invitation sent. The user can access Phaseboard after accepting.');await reload();onChanged();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const changeRole=async(userId:string,next:Role)=>{if(!window.confirm('Change this member to '+next+'?'))return;setBusy(true);setError('');try{await call('PATCH',{userId,role:next});await reload();onChanged();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const remove=async(userId:string)=>{if(!window.confirm('Remove this member from Phaseboard? Their project access will be revoked.'))return;setBusy(true);setError('');try{await call('DELETE',{userId});await reload();onChanged();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <div className="overlay" onMouseDown={onClose}><section className="modal userManagement" role="dialog" aria-modal="true" aria-label="Manage users" onMouseDown={e=>e.stopPropagation()}>
  <div className="modalHead"><span>Manage Users · Admin</span><button type="button" onClick={onClose} aria-label="Close user management">×</button></div>
  <p>Invite Editors and Viewers. Only Admins can manage membership. Project access is enforced by Supabase.</p>
  {error&&<p className="imageError" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <form className="inviteForm" onSubmit={invite}><h3>Invite user</h3><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="person@example.com"/></label><label>Role<select value={role} onChange={e=>setRole(e.target.value as 'editor'|'viewer')}><option value="viewer">Viewer — view and comment</option><option value="editor">Editor — manage permitted tasks</option></select></label><button type="submit" disabled={busy||!email.trim()}>Send invitation</button></form>
  <div className="memberHeading"><h3>Project members</h3><button type="button" className="ghost" onClick={()=>void reload()} disabled={loading}>Refresh</button></div>
  {loading?<p role="status">Loading members…</p>:<div className="memberRows">{members.map(m=><div className="memberRow" key={m.user_id}><div className="memberIdentity"><strong>{m.display_name||m.email||m.user_id.slice(0,8)}</strong><small>{m.email||m.user_id}</small></div><label className="memberRole"><span className="srOnly">Role for {m.email||m.user_id}</span><select value={m.role} disabled={busy} onChange={e=>void changeRole(m.user_id,e.target.value as Role)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label><button type="button" className="ghost" disabled={busy} onClick={()=>void remove(m.user_id)}>Remove</button></div>)}{members.length===0&&<p>No members found.</p>}</div>}
  <p className="userManagementNote">The last Admin cannot be demoted or removed. Existing users who already have Supabase accounts may need to be added through a separate membership flow.</p>
 </section></div>;
}
