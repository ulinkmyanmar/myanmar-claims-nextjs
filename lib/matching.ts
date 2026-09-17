// lib/matching.ts

export interface CensusMember {
  [key: string]: any
}

export interface ClaimRecord {
  [key: string]: any
}

// 格式化辅助函数
function cleanStr(val: any): string {
  if (!val) return ''
  return String(val).trim().toLowerCase().replace(/\s+/g, ' ')
}

function cleanNrc(val: any): string {
  if (!val) return ''
  const str = String(val).trim().toLowerCase().replace(/[\s\-_]/g, '')
  if (str === '—' || str === 'none' || str === 'null') return ''
  return str
}

export function matchMemberWithClaims(member: CensusMember, claims: ClaimRecord[]) {
  // 1. 提取 Uploaded Member 的姓名和 NRC
  const rawName = member.name || member.uploaded_member || member['UPLOADED MEMBER'] || member['Uploaded Member'] || ''
  const rawNrc = member.nrc || member['NRC / NATIONAL ID'] || member['NRC/NATIONAL ID'] || member.nrc_no || ''

  const inputName = cleanStr(rawName)
  const inputNrc = cleanNrc(rawNrc)

  if (!inputName) {
    return { isMatched: false, matchedClaims: [], claimsCount: 0, claimNo: '—' }
  }

  // 2. 在 Claims 数据库中寻找匹配项
  const matchedClaims = claims.filter((claim) => {
    const claimName = cleanStr(claim.patient_name || claim.name || claim.patientName || '')
    const claimNrc = cleanNrc(claim.nrc_no || claim.nrc || claim.nrcNo || '')

    // 规则 A：只要传了 NRC，必须 [姓名相等] AND [NRC相等]
    if (inputNrc) {
      return claimName === inputName && claimNrc === inputNrc
    }

    // 规则 B：如果没有 NRC，必须 [姓名严格完全相等]（阻止 John Tan2 匹配 John Tan）
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
