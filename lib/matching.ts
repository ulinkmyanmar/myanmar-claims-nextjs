// lib/matching.ts

export interface CensusMember {
  name: string
  nrc?: string
  dob?: string
  gender?: string
}

export interface ClaimRecord {
  patient_name: string
  nrc_no?: string
  claim_no: string
  // ... 其他字段
}

export function matchMemberWithClaims(member: CensusMember, claims: ClaimRecord[]) {
  // 1. 数据清洗（转小写、去空格）
  const inputName = member.name?.trim().toLowerCase() || ''
  const inputNrc = member.nrc?.trim().toLowerCase() || ''

  if (!inputName) {
    return { isMatched: false, matchedClaims: [] }
  }

  // 2. 筛选匹配记录：必须满足【姓名全等】且【NRC全等】
  const matchedClaims = claims.filter((claim) => {
    const claimName = claim.patient_name?.trim().toLowerCase() || ''
    const claimNrc = claim.nrc_no?.trim().toLowerCase() || ''

    // 规则 A：如果输入了 NRC，则要求 [姓名全等] AND [NRC全等]
    if (inputNrc && inputNrc !== '—' && inputNrc !== '') {
      return claimName === inputName && claimNrc === inputNrc
    }

    // 规则 B：如果没填 NRC，仅允许 [姓名完全相等]（绝对禁止使用 includes 或 LIKE 模糊匹配）
    return claimName === inputName
  })

  return {
    isMatched: matchedClaims.length > 0,
    matchedClaims,
    claimsCount: matchedClaims.length,
    claimNo: matchedClaims.length > 0 ? matchedClaims[0].claim_no : '—'
  }
}
