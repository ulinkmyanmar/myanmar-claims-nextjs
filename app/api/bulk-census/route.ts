import { NextResponse } from 'next/server'
import { demoClaims } from '@/lib/demo-data'
import { matchMemberWithClaims } from '@/lib/matching'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // 兼容多种前端传参格式：body 本身是数组、或者在 body.members / body.data 里面
    const membersList = Array.isArray(body) 
      ? body 
      : (body.members || body.data || body.census || [])

    if (!Array.isArray(membersList) || membersList.length === 0) {
      return NextResponse.json({ error: 'Invalid members data' }, { status: 400 })
    }

    // 循环调用 matchMemberWithClaims
    const results = membersList.map((member: any) => {
      const match = matchMemberWithClaims(member, demoClaims)

      return {
        name: member.name || member['UPLOADED MEMBER'] || member.uploaded_member || '—',
        nrc: member.nrc || member['NRC / NATIONAL ID'] || member.nrc_no || '—',
        dob: member.dob || member['DOB'] || '—',
        gender: member.gender || member['GENDER'] || '—',
        matchStatus: match.isMatched ? 'Matched' : 'No history',
        claimNo: match.claimNo,
        claimsCount: match.claimsCount,
        matchedClaims: match.matchedClaims,
      }
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Bulk Census Error:', error)
    return NextResponse.json({ error: 'Failed to process bulk census' }, { status: 500 })
  }
}
