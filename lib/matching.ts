// lib/matching.ts

export interface CensusMember {
  [key: string]: any
}

export interface ClaimRecord {
  [key: string]: any
}

// 辅助函数：清洗字符串（转小写、去除首尾及内部多余空格）
function cleanStr(val: any): string {
  if (val === null || val === undefined) return ''
  return String(val).trim().toLowerCase().replace(/\s+/g, ' ')
}

// 辅助函数：专门清洗 NRC（去除所有空格、连字符，只留纯文本）
function cleanNrc(val: any): string {
  if (!val) return ''
  const str = String(val).trim().toLowerCase().replace(/[\s\-_]/g, '')
  if (str === '—' || str === 'none' || str === 'null') return ''
  return str
}

export function matchMemberWithClaims(member: CensusMember, claims: ClaimRecord[]) {
  // 1. 动态获取 Member 的 Name 和 NRC（兼容 Name, name, member_name 等各种写法）
  const rawName = member.name || member.Name || member.patient_name || member.patientName || member['Uploaded Member'] || ''
  const rawNrc = member.nrc || member.Nrc || member.NRC || member.nrc_no || member['NRC / NATIONAL ID'] || ''

  const inputName = cleanStr(rawName)
  const inputNrc = cleanNrc(rawNrc)

  // 如果连名字都没有，直接返回未匹配
  if (!inputName) {
    return { isMatched: false, matchedClaims: [], claimsCount: 0, claimNo: '—' }
  }

  // 2. 执行严格匹配
  const matchedClaims = claims.filter((claim) => {
    // 动态获取 Claim 的 Name 和 NRC
    const claimName = cleanStr(claim.patient_name || claim.name || claim.patientName || '')
    const claimNrc = cleanNrc(claim.nrc_no || claim.nrc || claim.nrcNo || '')

    // 规则 A：如果上传的记录中有有效的 NRC，必须【姓名完全一致】且【NRC完全一致】
    if (inputNrc) {
      return claimName === inputName && claimNrc === inputNrc
    }

    // 规则 B：如果没有 NRC，仅要求【姓名完全一致】（防误触：John Tan2 不等于 John Tan）
    return claimName === inputName
  })

  const firstMatched = matchedClaims[0]
  const matchedClaimNo = firstMatched 
    ? (firstMatched.claim_no || firstMatched.claimNo || firstMatched.claim_number || '—') 
    : '—'

  return {
    isMatched: matchedClaims.length > 0,
    matchedClaims,
    claimsCount: matchedClaims.length,
    claimNo: matchedClaimNo
  }
}
