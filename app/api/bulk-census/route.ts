// app/api/bulk-census/route.ts
import { NextResponse } from 'next/server'
import { demoClaims } from '@/lib/demo-data'
import { matchMemberWithClaims } from '@/lib/matching'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // 兼容各种传参格式（数组、{ members: [] } 或 { data: [] }）
    let rawMembers: any[] = []
    if (Array.isArray(body)) {
      rawMembers = body
    } else if (body && Array.isArray(body.members)) {
      rawMembers = body.members
    } else if (body && Array.isArray(body.data)) {
      rawMembers = body.data
    }

    if (!rawMembers || rawMembers.length === 0) {
      return NextResponse.json(
        { error: 'Invalid members data' },
        { status: 400 }
      )
    }

    // 循环执行匹配
    const results = rawMembers.map((member: any) => {
      const match = matchMemberWithClaims(member, demoClaims)

      return {
        uploaded_member: member.name || member['UPLOADED MEMBER'] || '—',
        nrc: member.nrc || member['NRC / NATIONAL ID'] || '—',
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
    console.error('Bulk API Error:', error)
    return NextResponse.json({ error: 'Failed to process bulk census' }, { status: 500 })
  }
}
