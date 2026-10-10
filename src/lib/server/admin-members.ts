import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export function reply(error:string,status=400){return NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});}
export async function authorize(req:NextRequest,projectId:string){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const publishable=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY;
 if(!url||!publishable||!secret)throw new Error('Server configuration missing: SUPABASE_SECRET_KEY or public Supabase variables');
 const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 if(!token)throw new Error('Unauthorized');
 const publicClient=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await publicClient.auth.getUser(token);
 if(userError||!user)throw new Error('Unauthorized');
 // Query using caller JWT so RLS still verifies project membership.
 const caller=createClient(url,publishable,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:checked,error:checkError}=await caller.from('project_members').select('role').eq('project_id',projectId).eq('user_id',user.id).maybeSingle();
 if(checkError)throw new Error('Could not verify membership: '+checkError.message);
 if(checked?.role!=='admin')throw new Error('Admin access required');
 const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 return {service,user};
}
export function failure(e:unknown){const message=e instanceof Error?e.message:'Unexpected server error';return reply(message,message==='Unauthorized'?401:message==='Admin access required'?403:400);}
