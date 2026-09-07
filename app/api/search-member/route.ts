import { NextResponse } from 'next/server'
import { demoClaims, demoMembers } from '@/lib/demo-data'
import { findMemberMatches } from '@/lib/matching'
export async function POST(req: Request){ const body=await req.json();const matches=findMemberMatches(body,demoMembers).map(m=>({...m, claims: demoClaims.filter(c=>c.member_id===m.member.id)})); return NextResponse.json({matches, coverageDate:'30-Jun-2026'}) }
