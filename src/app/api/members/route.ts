import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  const projectId=req.nextUrl.searchParams.get('projectId')||'';
  if(!/^[0-9a-f-]{36}$/i.test(projectId))return NextResponse.json({error:'Invalid project'},{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,secret=process.env.SUPABASE_SECRET_KEY!;
  if(!url||!anon||!secret)throw new Error('Server Supabase configuration missing');
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return NextResponse.json({error:'Unauthorized'},{status:401});
  const publicClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await publicClient.auth.getUser(token);
  if(authError||!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:membership,error:membershipError}=await caller.from('project_members').select('user_id').eq('project_id',projectId).eq('user_id',user.id).maybeSingle();
  if(membershipError)throw membershipError;
  if(!membership)return NextResponse.json({error:'Not a project member'},{status:403});
  const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:members,error:membersError}=await service.from('project_members').select('user_id,role').eq('project_id',projectId);
  if(membersError)throw membersError;
  const result=await Promise.all((members||[]).map(async m=>{const {data:u}=await service.auth.admin.getUserById(m.user_id);return {...m,email:u?.user?.email||'',display_name:u?.user?.user_metadata?.full_name||''}}));
  return NextResponse.json({members:result},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Request failed'},{status:500});}
}
