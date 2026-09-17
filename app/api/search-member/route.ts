import { NextResponse } from 'next/server'
import { demoClaims, demoMembers } from '@/lib/demo-data'
import { matchMemberWithClaims } from '@/lib/matching'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // 调用更新后的 matchMemberWithClaims 函数
    const result = matchMemberWithClaims(body, demoClaims)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to search member' }, { status: 500 })
  }
}
