import * as XLSX from 'xlsx'

// Treat identifiers and arbitrary database values as text and prevent spreadsheet
// applications from interpreting user-provided strings as formulas.
function excelText(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /^[\s\u0000-\u001f]*[=+@\-\t\r]/.test(text) ? `'${text}` : text
}

export function exportExcel(
  filename: string,
  sheets: { name: string; rows: Record<string, unknown>[]; headers: string[] }[],
) {
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const values = sheet.rows.map((row) =>
      Object.fromEntries(sheet.headers.map((key) => [key, excelText(row[key])])),
    )
    const worksheet = XLSX.utils.json_to_sheet(values, { header: sheet.headers })
    worksheet['!cols'] = sheet.headers.map((key) => ({ wch: Math.min(45, Math.max(16, key.length + 4)) }))
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }
  XLSX.writeFile(workbook, filename)
}

export function excelDateStamp() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
