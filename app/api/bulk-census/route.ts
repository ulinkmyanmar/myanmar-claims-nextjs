import { NextResponse } from 'next/server'
import { demoClaims } from '@/lib/demo-data'
import { matchMemberWithClaims } from '@/lib/matching'

export async function POST(req: Request) {
  try {
    const { members } = await req.json()

    if (!Array.isArray(members)) {
      return NextResponse.json({ error: 'Invalid members data' }, { status: 400 })
    }

    // 循环调用统一的强校验匹配算法
    const results = members.map((member) => {
      const matchResult = matchMemberWithClaims(member, demoClaims)

      return {
        ...member,
        matchStatus: matchResult.isMatched ? 'Matched' : 'No history',
        claimNo: matchResult.claimNo,
        claimsCount: matchResult.claimsCount,
        matchedClaims: matchResult.matchedClaims,
      }
    })

    return NextResponse.json({ results })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process bulk census' }, { status: 500 })
  }
}
