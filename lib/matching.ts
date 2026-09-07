import { Member } from './demo-data'

export type SearchInput = { fullName?:string; nrc?:string; dateOfBirth?:string; gender?:string; keyword?:string }

export function normalizeName(v = '') { return v.trim().toLowerCase().replace(/\s+/g, ' ') }
export function normalizeNrc(v = '') { return v.toLowerCase().replace(/[^a-z0-9]/g, '') }

export function scoreMember(input: SearchInput, member: Member) {
  let score = 0
  const reasons: string[] = []
  const nrc = normalizeNrc(input.nrc || '')
  const name = normalizeName(input.fullName || '')
  const keyword = normalizeName(input.keyword || '')
  const keywordNrc = normalizeNrc(input.keyword || '')

  if (nrc && member.normalized_nrc === nrc) { score += 100; reasons.push('NRC exact match') }
  if (name) {
    if (member.normalized_name === name) { score += 70; reasons.push('Name exact match') }
    else if (member.normalized_name.includes(name) || name.includes(member.normalized_name)) { score += 45; reasons.push('Partial name match') }
  }
  if (keyword) {
    if (member.normalized_name.includes(keyword)) { score += 45; reasons.push('Keyword name match') }
    if (keywordNrc && member.normalized_nrc?.includes(keywordNrc)) { score += 60; reasons.push('Keyword NRC match') }
  }
  if (input.dateOfBirth && input.dateOfBirth === member.date_of_birth) { score += 35; reasons.push('Date of birth match') }
  if (input.gender && input.gender === member.gender) { score += 15; reasons.push('Gender match') }
  return { score, reasons }
}

export function findMemberMatches(input: SearchInput, members: Member[]) {
  if (!input.fullName && !input.nrc && !input.dateOfBirth && !input.gender && !input.keyword) return []
  return members.map(member => ({ member, ...scoreMember(input, member) })).filter(x => x.score >= 35).sort((a, b) => b.score - a.score)
}