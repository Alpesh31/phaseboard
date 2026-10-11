'use client';

import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ProfileMenuContext, MenuActions } from './profile-menu';

type Role = 'admin' | 'editor' | 'viewer';
type Membership = { project_id: string; role: Role };
type Gate = 'checking' | 'signed-out' | 'authorized' | 'no-membership' | 'lookup-error';
export type AccessContext = { projectId: string; userId: string; role: Role };
export const Access = createContext<AccessContext | null>(null);
export const useAccess = () => useContext(Access);

export default function AuthShell({ children }: { children: ReactNode }) {
  const client = useMemo(() => { try { return getSupabaseClient(); } catch { return null; } }, []);
  const [user, setUser] = useState<User | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [gate, setGate] = useState<Gate>('checking');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [menuOpen,setMenuOpen]=useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const [profileOpen,setProfileOpen]=useState(false);
  const [fullName,setFullName]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [profileBusy,setProfileBusy]=useState(false);
  const [profileError,setProfileError]=useState('');
  const [actions,setActions]=useState<MenuActions>({});
  const registerActions=useMemo(()=>((next:MenuActions)=>{setActions(next);return ()=>setActions({});}),[]);
  const requestId = useRef(0);
  const lastUserId = useRef<string | null>(null);
  const checkRef = useRef<(current: User | null) => Promise<void>>(async () => {});

  useEffect(() => {
    if (!client) return;
    let active = true;
    const check = async (current: User | null) => {
      const id = ++requestId.current;
      if (!active) return;
      setUser(current);
      setError('');
      if (!current) {
        lastUserId.current = null;
        setMembership(null);
        setGate('signed-out');
        return;
      }
      lastUserId.current = current.id;
      setGate('checking');
      try {
        // Avoid embedded projects(name) join: it can fail under some RLS policies.
        const { data, error: lookupError } = await client.from('project_members')
          .select('project_id,role')
          .eq('user_id', current.id)
          .order('project_id', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!active || id !== requestId.current) return;
        if (lookupError) {
          setMembership(null);
          setError(`Could not verify membership: ${lookupError.message}`);
          setGate('lookup-error');
        } else if (!data) {
          setMembership(null);
          setGate('no-membership');
        } else {
          setMembership(data as Membership);
          setGate('authorized');
        }
      } catch (e) {
        if (!active || id !== requestId.current) return;
        setMembership(null);
        setError(e instanceof Error ? e.message : 'Membership check failed.');
        setGate('lookup-error');
      }
    };
    checkRef.current = check;
    // INITIAL_SESSION supplies the initial user. TOKEN_REFRESHED should not
    // clear membership or remount the board for the same user.
    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      const current = session?.user ?? null;
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (current && lastUserId.current === current.id) return;
        // Do not make Supabase queries synchronously inside the auth callback.
        setTimeout(() => { if (active) void check(current); }, 0);
      } else if (event === 'SIGNED_OUT') {
        void check(null);
      }
    });
    return () => { active = false; requestId.current++; subscription.subscription.unsubscribe(); };
  }, [client]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client) return;
    setBusy(true); setError('');
    try {
      const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) setError(signInError.message);
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
  };
  const retry = async () => {
    if (!client) return;
    setGate('checking');
    try {
      const { data, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      await checkRef.current(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to verify session.');
      setGate('lookup-error');
    }
  };

  const saveProfile=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!client||!user)return;
    setProfileError('');
    const name=fullName.trim();
    if(name.length<2){setProfileError('Enter your full name.');return;}
    if(newPassword && (newPassword.length<8 || newPassword!==confirmPassword)){setProfileError('Passwords must match and contain at least 8 characters.');return;}
    if(!user.user_metadata?.phaseboard_onboarded && !newPassword){setProfileError('Create a password to finish setup.');return;}
    setProfileBusy(true);
    try{
      const {error:profileErr}=await client.from('profiles').upsert({id:user.id,display_name:name},{onConflict:'id'});
      if(profileErr)throw profileErr;
      const {data,error:updateError}=await client.auth.updateUser({data:{full_name:name,phaseboard_onboarded:true},...(newPassword?{password:newPassword}:{})});
      if(updateError)throw updateError;
      if(data.user)setUser(data.user);
      setNewPassword('');setConfirmPassword('');setProfileOpen(false);
    }catch(e){setProfileError(e instanceof Error?e.message:'Unable to save profile.');}
    finally{setProfileBusy(false);}
  };
  useEffect(() => {
  if (!menuOpen) return;

  const handleOutsideClick = (event: PointerEvent) => {
    if (
      profileMenuRef.current &&
      !profileMenuRef.current.contains(event.target as Node)
    ) {
      setMenuOpen(false);
    }
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setMenuOpen(false);
    }
  };

  document.addEventListener('pointerdown', handleOutsideClick);
  document.addEventListener('keydown', handleEscape);

  return () => {
    document.removeEventListener('pointerdown', handleOutsideClick);
    document.removeEventListener('keydown', handleEscape);
  };
}, [menuOpen]);
  const mustOnboard=!!user&&!user.user_metadata?.phaseboard_onboarded;
  useEffect(()=>{if(user?.user_metadata?.full_name)setFullName(user.user_metadata.full_name)},[user?.id]);
  const profileForm=(required:boolean)=><div className="authPage"><form className="authCard" onSubmit={saveProfile}>
    <div className="authBrand">Phaseboard</div><h1>{required?'Finish setting up your account':'My Profile'}</h1>
    <p>{required?'Set your full name and create a password before opening ATLAS360.':'Update your name or change your password.'}</p>
    <label>Full name<input required minLength={2} value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name" placeholder="First and last name"/></label>
    <label>{required?'Create password':'New password (optional)'}<input type="password" autoComplete="new-password" minLength={8} required={required} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
    <label>Confirm password<input type="password" autoComplete="new-password" required={required||!!newPassword} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
    {profileError&&<p role="alert" className="authError">{profileError}</p>}
    <button type="submit" disabled={profileBusy}>{profileBusy?'Saving…':required?'Complete setup':'Save changes'}</button>
    {!required&&<button type="button" className="ghost" onClick={()=>setProfileOpen(false)}>Cancel</button>}
    {required&&<button type="button" className="ghost" onClick={()=>void signOut()}>Sign out</button>}
  </form></div>;
  if (!client) return <div className="authPage"><div className="authCard"><h1>Phaseboard</h1><p role="alert">Supabase configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.</p></div></div>;
  if (gate === 'checking') return <div className="authPage"><div className="authCard"><p role="status">Verifying your Phaseboard access…</p></div></div>;
  if (gate === 'signed-out') return <div className="authPage"><form className="authCard" onSubmit={signIn}>
    <div className="authBrand">Phaseboard</div><h1>Welcome back</h1><p>Sign in with your ATLAS260 account.</p>
    <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label>
    {error && <p role="alert" className="authError">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <small>Accounts and invitations are managed by an Admin.</small>
  </form></div>;
  if (gate === 'lookup-error') return <div className="authPage"><div className="authCard"><h1>Unable to verify access</h1><p>The membership check failed. This does not necessarily mean your account was removed.</p><p role="alert" className="authError">{error}</p><button type="button" onClick={() => void retry()}>Retry</button><button type="button" onClick={() => void signOut()}>Sign out</button></div></div>;
  if (gate === 'no-membership') return <div className="authPage"><div className="authCard"><h1>Access pending</h1><p>Your account is signed in, but it has no Phaseboard project membership. Ask the Admin to grant access.</p><button type="button" onClick={() => void retry()}>Check again</button><button type="button" onClick={() => void signOut()}>Sign out</button></div></div>;
  if (!user || !membership) return <div className="authPage"><p role="status">Verifying your Phaseboard access…</p></div>;
  if(mustOnboard)return profileForm(true);
  if(profileOpen)return profileForm(false);
  return <ProfileMenuContext.Provider value={{registerActions}}><div className="authSession">
  <div className="profileDropdown" ref={profileMenuRef}><button type="button" className="profileTrigger" aria-expanded={menuOpen} aria-haspopup="menu" onClick={()=>setMenuOpen(v=>!v)}><span className="profileAvatar">{(user.user_metadata?.full_name||user.email||'U').slice(0,1).toUpperCase()}</span><span className="profileName">{user.user_metadata?.full_name||user.email}</span><span aria-hidden="true">⌄</span></button>{menuOpen&&<div className="profileMenu" role="menu"><div className="profileMenuIdentity"><strong>{user.user_metadata?.full_name||user.email}</strong><small>{user.email} · {membership.role}</small></div><button role="menuitem" onClick={()=>{setFullName(user.user_metadata?.full_name||'');setProfileOpen(true);setMenuOpen(false)}}>My Profile</button>{membership.role==='admin'&&<><button role="menuitem" onClick={()=>{actions.manageUsers?.();setMenuOpen(false)}}>Manage Users</button><button role="menuitem" onClick={()=>{actions.managePhases?.();setMenuOpen(false)}}>Manage Phase Permissions</button></>}<button
  role="menuitem"
  onClick={() => {
    setMenuOpen(false);
    void signOut();
  }}
>
  Sign Out
</button></div>}</div></div><Access.Provider value={{projectId:membership.project_id,userId:user.id,role:membership.role}}>{children}</Access.Provider></ProfileMenuContext.Provider>;
}
