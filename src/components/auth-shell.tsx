'use client';

import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';

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
  return <><div className="authSession"><span>{user.email} · <strong>{membership.role}</strong></span><button type="button" onClick={() => void signOut()}>Sign out</button></div><Access.Provider value={{projectId:membership.project_id,userId:user.id,role:membership.role}}>{children}</Access.Provider></>;
}
