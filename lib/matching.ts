// lib/matching.ts

export interface CensusMember {
  name: string
  nrc?: string
  dob?: string
  gender?: string
}

// 兼容驼峰 (demoClaims) 和 下划线 (Supabase DB) 两种属性结构
export interface ClaimRecord {
  patient_name?: string
  name?: string
  nrc_no?: string
  nrc?: string
  claim_no?: string
  claimNo?: string
  [key: string]: any
}

export function matchMemberWithClaims(member: CensusMember, claims: ClaimRecord[]) {
  const inputName = member.name?.trim().toLowerCase() || ''
  const inputNrc = member.nrc?.trim().toLowerCase() || ''

  if (!inputName) {
    return { isMatched: false, matchedClaims: [] }
  }

  const matchedClaims = claims.filter((claim) => {
    // 兼容取值：优先取 patient_name，没有则取 name
    const claimName = (claim.patient_name || claim.name || '').trim().toLowerCase()
    // 兼容取值：优先取 nrc_no，没有则取 nrc
    const claimNrc = (claim.nrc_no || claim.nrc || '').trim().toLowerCase()

    // 规则 A：若输入了 NRC，必须 [姓名全等] 并且 [NRC全等]
    if (inputNrc && inputNrc !== '—' && inputNrc !== '') {
      return claimName === inputName && claimNrc === inputNrc
    }

    // 规则 B：若无 NRC，仅允许 [姓名完全相等]
    return claimName === inputName
  })

  // 兼容获取理赔号
  const firstMatched = matchedClaims[0]
  const matchedClaimNo = firstMatched 
    ? (firstMatched.claim_no || firstMatched.claimNo || '—') 
    : '—'

  return {
    isMatched: matchedClaims.length > 0,
    matchedClaims,
    claimsCount: matchedClaims.length,
    claimNo: matchedClaimNo
  }
}
