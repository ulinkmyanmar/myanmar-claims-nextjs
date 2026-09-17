'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

export interface BulkResultRow {
  uploaded_member: string
  nrc: string
  dob: string
  gender: string
  matchStatus: 'Matched' | 'No history' | 'Pending'
  claimNo: string
  claimsCount: number
  matchedClaims?: any[]
}

export default function BulkCensusClient() {
  const [results, setResults] = useState<BulkResultRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setLoading(true)
    setError(null)

    try {
      // 1. 读取 Excel 文件
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      // 转换为原始 JSON 数组
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet)

      // 2. 字段清洗与规范化映射（兼容各种 Excel 表头格式）
      const normalizedMembers = rawRows.map((row) => ({
        name: String(
          row['UPLOADED MEMBER'] ||
          row['Uploaded Member'] ||
          row['Name'] ||
          row['name'] ||
          ''
        ).trim(),
        nrc: String(
          row['NRC / NATIONAL ID'] ||
          row['NRC/NATIONAL ID'] ||
          row['NRC'] ||
          row['nrc'] ||
          row['National ID'] ||
          ''
        ).trim(),
        dob: String(
          row['DOB'] ||
          row['dob'] ||
          row['Date of Birth'] ||
          ''
        ).trim(),
        gender: String(
          row['GENDER'] ||
          row['Gender'] ||
          row['gender'] ||
          ''
        ).trim(),
      }))

      // 过滤未包含名字的空行
      const validMembers = normalizedMembers.filter((m) => m.name.length > 0)

      if (validMembers.length === 0) {
        setError('Invalid members data: No valid member names found in Excel.')
        setLoading(false)
        return
      }

      // 3. 发送强校验结构 JSON 到 API Route
      const res = await fetch('/api/bulk-census', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: validMembers }),
      })

      const data = await res.json()

      if (res.ok) {
        setResults(data.results)
        setError(null)
      } else {
        setError(data.error || 'Failed to process bulk census')
      }
    } catch (err) {
      console.error('File processing error:', err)
      setError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls document.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* 文件上传区域 */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Insurer Census File (.xlsx)
        </label>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          disabled={loading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
        />
        {fileName && (
          <p className="mt-2 text-xs text-gray-600">
            Uploaded file: <span className="font-semibold">{fileName}</span>
          </p>
        )}
      </div>

      {/* 错误提示框 */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 批量结果表格 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 font-bold text-gray-800">
          Bulk Result
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Uploaded Member</th>
              <th className="px-4 py-3 text-left">NRC / National ID</th>
              <th className="px-4 py-3 text-left">DOB</th>
              <th className="px-4 py-3 text-left">Gender</th>
              <th className="px-4 py-3 text-left">Match Status</th>
              <th className="px-4 py-3 text-left">Claim No</th>
              <th className="px-4 py-3 text-left">Claims</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  Processing census data...
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  No data loaded. Please upload a census file.
                </td>
              </tr>
            ) : (
              results.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.uploaded_member}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.nrc}</td>
                  <td className="px-4 py-3 text-gray-600">{row.dob}</td>
                  <td className="px-4 py-3 text-gray-600">{row.gender}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        row.matchStatus === 'Matched'
                          ? 'bg-green-100 text-green-800'
                          : row.matchStatus === 'No history'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {row.matchStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.claimNo}</td>
                  <td className="px-4 py-3 text-gray-600">{row.claimsCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
