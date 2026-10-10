'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';

type Membership = { project_id: string; role: 'admin' | 'editor' | 'viewer'; projects: { name: string } | { name: string }[] | null };

export default function AuthShell({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    try { return getSupabaseClient(); } catch { return null; }
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!client) { setLoading(false); return; }
    let alive = true;
    const refresh = async (current: User | null) => {
      if (!alive) return;
      setUser(current);
      setMembership(null);
      if (current) {
        const { data, error: membershipError } = await client.from('project_members')
          .select('project_id,role,projects(name)')
          .eq('user_id', current.id)
          .limit(1)
          .maybeSingle();
        if (!alive) return;
        if (membershipError) setError(`Membership lookup failed: ${membershipError.message}`);
        else setMembership((data as Membership | null) ?? null);
      }
      if (alive) setLoading(false);
    };
    void client.auth.getUser().then(({ data }) => refresh(data.user)).catch(() => { if (alive) setLoading(false); });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      // Schedule database calls outside the synchronous auth callback.
      queueMicrotask(() => { if (alive) void refresh(session?.user ?? null); });
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [client]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client) return;
    setBusy(true); setError('');
    const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message);
    setBusy(false);
  };
  const signOut = async () => {
    if (!client) return;
    setError('');
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
  };
  if (!client) return <div className="authPage"><div className="authCard"><h1>Phaseboard</h1><p role="alert">Supabase configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.</p></div></div>;
  if (loading) return <div className="authPage"><p role="status">Checking your Phaseboard access…</p></div>;
  if (!user) return <div className="authPage"><form className="authCard" onSubmit={signIn}>
    <div className="authBrand">Phaseboard</div><h1>Welcome back</h1><p>Sign in with the account created in ATLAS260.</p>
    <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label>
    {error && <p role="alert" className="authError">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <small>Accounts and invitations are managed by an Admin. Public sign-up is disabled in this interface.</small>
  </form></div>;
  if (!membership) return <div className="authPage"><div className="authCard"><h1>Access pending</h1><p>Your account is signed in, but it has no Phaseboard project membership. Ask the Admin to grant access.</p>{error && <p role="alert" className="authError">{error}</p>}<button onClick={() => void signOut()}>Sign out</button></div></div>;
  return <><div className="authSession"><span>{user.email} · <strong>{membership.role}</strong></span><button type="button" onClick={() => void signOut()}>Sign out</button></div>{children}</>;
}
