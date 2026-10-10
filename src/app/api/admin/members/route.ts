import { NextRequest, NextResponse } from 'next/server';
import { authorize, failure, reply } from '@/lib/server/admin-members';
export const runtime='nodejs';export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles=['admin','editor','viewer'];
async function input(req:NextRequest){const body=await req.json();if(!uuid.test(body.projectId||''))throw new Error('Invalid project ID');return body;}
export async function GET(req:NextRequest){try{
 const projectId=req.nextUrl.searchParams.get('projectId')||'';if(!uuid.test(projectId))return reply('Invalid project ID');
 const {service}=await authorize(req,projectId);
 const {data,error}=await service.from('project_members').select('user_id,role').eq('project_id',projectId).order('role');if(error)throw error;
 const members=await Promise.all((data||[]).map(async m=>{const {data:u}=await service.auth.admin.getUserById(m.user_id);return {...m,email:u?.user?.email||'',display_name:u?.user?.user_metadata?.full_name||''};}));
 return NextResponse.json({members},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{
 const body=await input(req);const email=String(body.email||'').trim().toLowerCase();const role=body.role;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply('Valid email required');
 if(!['editor','viewer'].includes(role))return reply('Only Editor and Viewer invitations are allowed');
 const {service}=await authorize(req,body.projectId);
 const redirectTo=process.env.NEXT_PUBLIC_SITE_URL||'https://phaseboard-alpha.vercel.app';
 const {data,error}=await service.auth.admin.inviteUserByEmail(email,{redirectTo});if(error)throw error;
 const userId=data.user?.id;if(!userId)throw new Error('Invitation returned no user ID');
 const {error:memberError}=await service.from('project_members').upsert({project_id:body.projectId,user_id:userId,role},{onConflict:'project_id,user_id',ignoreDuplicates:true});
 if(memberError)throw new Error('Invitation was sent, but membership could not be saved: '+memberError.message);
 return NextResponse.json({ok:true});
 }catch(e){return failure(e);}}
export async function PATCH(req:NextRequest){try{
 const body=await input(req);if(!uuid.test(body.userId||'')||!roles.includes(body.role))return reply('Invalid member or role');
 const {service}=await authorize(req,body.projectId);
 const {data,error}=await service.from('project_members').update({role:body.role}).eq('project_id',body.projectId).eq('user_id',body.userId).select('user_id').maybeSingle();
 if(error)throw error;if(!data)return reply('Member not found',404);return NextResponse.json({ok:true});
 }catch(e){return failure(e);}}
export async function DELETE(req:NextRequest){try{
 const body=await input(req);if(!uuid.test(body.userId||''))return reply('Invalid member');
 const {service}=await authorize(req,body.projectId);
 const {data,error}=await service.from('project_members').delete().eq('project_id',body.projectId).eq('user_id',body.userId).select('user_id').maybeSingle();
 if(error)throw error;if(!data)return reply('Member not found',404);return NextResponse.json({ok:true});
 }catch(e){return failure(e);}}
