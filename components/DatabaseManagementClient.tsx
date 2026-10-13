"use client"

import { useEffect, useRef, useState } from 'react'
import {
  Upload,
  CheckCircle2,
} from 'lucide-react'

import {
  COVERAGE_DATE,
  CURRENT_VERSION,
} from '@/lib/constants'

export default function DatabaseManagementClient() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState('')
  const [version, setVersion] = useState('')
  const [coverageDate, setCoverageDate] = useState('')

  const [validated, setValidated] = useState(false)
  const [preview, setPreview] = useState(false)
  const [message, setMessage] = useState('')
  const [syncResult, setSyncResult] = useState<any>(null)
  const [comparisonFilter, setComparisonFilter] = useState('ALL')
  const [selectedClaim, setSelectedClaim] = useState<any>(null)

  type SyncHistoryItem = {
    version: string
    coverageDate: string
    status: "Active" | "Archived"
    method: string
    updatedBy: string
    updatedOn: string
  }

  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([
    {
      version: CURRENT_VERSION,
      coverageDate: COVERAGE_DATE,
      status: "Active",
      method: "Initial snapshot",
      updatedBy: "Admin Myanmar",
      updatedOn: "Initial snapshot",
    },
  ])

  // 1. 组件挂载时自动从数据库拉取持久化的历史记录
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/database-sync/history', { cache: 'no-store' })
        const data = await res.json()
        if (data.history && data.history.length > 0) {
          const formattedHistory = data.history.map((item: any) => ({
            version: item.version || 'New Snapshot',
            coverageDate: item.coverage_date || item.coverageDate || '-',
            status: (item.status || 'Active') as "Active" | "Archived",
            method: item.method || 'Controlled sync / upsert',
            updatedBy: item.updated_by || item.updatedBy || 'Admin Myanmar',
            updatedOn: item.createddatetime
              ? new Date(item.createddatetime).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }).replace(/ /g, '-')
              : 'Recently',
          }))
          setSyncHistory(formattedHistory)
        }
      } catch (e) {
        console.error('Failed to fetch sync history from database', e)
      }
    }

    fetchHistory()
  }, [])

  function chooseFile() {
    fileInputRef.current?.click()
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setSyncResult(null)
    setSelectedClaim(null)
    setValidated(false)
    setPreview(false)
    setMessage('')
  }

  function clearForm() {
    setFileName('')
    setVersion('')
    setCoverageDate('')
    setValidated(false)
    setPreview(false)
    setMessage('')
    setSyncResult(null)
    setSelectedClaim(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 2. 验证并解析 Excel 文件
  async function validatePreview() {
    if (!fileName || !fileInputRef.current?.files?.[0]) {
      setMessage('Please select a claims snapshot file first.')
      return
    }

    if (!version.trim()) {
      setMessage('Please enter the new snapshot version.')
      return
    }

    if (!coverageDate) {
      setMessage('Please enter the claims coverage date.')
      return
    }

    try {
      setMessage('Parsing and validating Excel file...')
      const file = fileInputRef.current.files[0]
      const formData = new FormData()
      formData.append('file', file)
      formData.append('version', version)
      formData.append('coverageDate', coverageDate)

      const response = await fetch('/api/database-sync/preview', {
        method: 'POST',
        body: formData,
      })

      const responseText = await response.text()
      let result: any = {}

      try {
        result = JSON.parse(responseText)
      } catch (err) {
        setMessage(`Server returned non-JSON response (Status ${response.status}).`)
        setValidated(false)
        setPreview(false)
        return
      }

      if (!response.ok) {
        setMessage(result.error || 'Failed to parse preview data.')
        setValidated(false)
        setPreview(false)
        return
      }

      setSyncResult(result)
      setSelectedClaim(null)
      setComparisonFilter('ALL')
      setValidated(true)
      setPreview(true)
      setMessage('Validation preview completed. Review the changes below; synchronization is not enabled yet.')
    } catch (err: any) {
      console.error(err)
      setMessage(err.message || 'An error occurred during file parsing.')
      setValidated(false)
      setPreview(false)
    }
  }

  // 3. 确认同步并提交到系统存储/数据库
  async function confirmSync() {
    if (!validated || !syncResult) {
      setMessage('Please validate and preview the snapshot before activating it.')
      return
    }

    if (!version.trim() || !coverageDate) {
      setMessage('Snapshot version and coverage date are required.')
      return
    }

    try {
      setMessage('Synchronizing data to live database...')

      // 数据清洗与字段 Mapping，避免包含空格的复杂 key 破坏服务端 JSON 格式
      // 只提交真正的新增记录，避免重复插入已存在的记录；
      // Claim No 列名做多种兼容匹配，防止表头写法不一致导致静默丢失数据
      const safeRecords = (syncResult.parsedRecords || [])
        .filter((row: any) => row["_status"] === "NEW_RECORD")
        .map((row: any) => ({
          memberId: row.memberId || "",
          clientName: row.clientName || "",
          dateOfBirth: row.dateOfBirth || null,
          gender: row.gender || null,
          claimNo: row.claimNo || "",
          incidentDate: row.incidentDate || null,
          description: row.description || "",
        }))

      const response = await fetch('/api/database-sync/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: version.trim(),
          coverageDate,
          records: safeRecords,
        }),
      })

      const responseText = await response.text()
      let resData: any = {}

      try {
        resData = JSON.parse(responseText)
      } catch (e) {
        console.error('Non-JSON response from server:', responseText)
        setMessage(`Server returned non-JSON error (Status ${response.status}). Please check server logs.`)
        return
      }

      if (!response.ok) {
        setMessage(resData.error || 'Failed to sync database.')
        return
      }

      const formattedCoverageDate = new Date(`${coverageDate}T00:00:00`)
        .toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        .replace(/ /g, '-')

      const updatedOn = new Date()
        .toLocaleDateString('en-GB', {
          timeZone: 'Asia/Singapore',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        .replace(/ /g, '-')

      // 同步更新前端历史列表显示
      setSyncHistory((previous) => {
        const archived = previous.map((item) => ({
          ...item,
          status: item.status === 'Active' ? ('Archived' as const) : item.status,
        }))

        return [
          {
            version: version.trim(),
            coverageDate: formattedCoverageDate,
            status: 'Active',
            method: 'Controlled sync / upsert',
            updatedBy: 'Admin Myanmar',
            updatedOn,
          },
          ...archived,
        ]
      })

      setValidated(false)
      setPreview(false)
      setMessage(
        `Synchronization confirmed! Submitted ${resData.submittedCount ?? safeRecords.length} record(s), actually inserted ${resData.insertedCount ?? 0} new claim(s) into the database.`
      )
    } catch (err: any) {
      console.error(err)
      setMessage(err.message || 'Failed to sync database.')
    }
  }

  return (
    <section className="grid gap-6">
      {/* Page heading */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">
            Historical database synchronization
          </h1>
          <p className="mt-2 max-w-4xl text-lg text-muted">
            Upload the latest full slim/indexed claims snapshot, validate it in staging, then synchronize the live historical database.
          </p>
        </div>

      </div>

      {/* Current snapshot */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              Current historical claims snapshot
            </h2>
            <p className="mt-2 text-muted">
              This active dataset is used by member searches and Phase 2 census checking.
            </p>
          </div>

          <span className="pill pill-green">Active</span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="Database version" value={CURRENT_VERSION} />
          <InfoCard label="Claims covered through" value={COVERAGE_DATE} />
          <InfoCard label="Source" value="Slim/indexed snapshot import" />
          <InfoCard label="Records in prototype" value="3 members / 5 claims" />
        </div>
      </div>

      {/* Upload section */}
      <div className="card">
        <h2 className="text-2xl font-bold">Upload new full claims snapshot</h2>
        <p className="mt-2 text-muted">
          The uploaded file should contain the complete historical snapshot, including the newest approved claims.
        </p>

        {/* Upload box */}
        <div
          className="mt-6 cursor-pointer rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-12 text-center transition hover:bg-blue-50"
          onClick={chooseFile}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-brand">
            <Upload size={30} />
          </div>

          <h3 className="mt-5 text-2xl font-bold">
            Select latest slim/indexed claims file
          </h3>
          <p className="mt-2 text-muted">
            Use the processed full claims-history file, not an insurer census file.
          </p>

          <button
            type="button"
            className="btn mt-6"
            onClick={(event) => {
              event.stopPropagation()
              chooseFile()
            }}
          >
            Choose claims snapshot
          </button>

          <p className="mt-3 text-muted">
            {fileName ? fileName : 'No file selected'}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Form */}
        <div className="mt-6 grid gap-5 border-t border-line pt-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block font-semibold">
              New snapshot version *
            </label>
            <input
              type="text"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="e.g., Claims History 2022–Dec 2026"
              className="w-full rounded-xl border border-line bg-white px-4 py-4 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold">
              Claims covered through *
            </label>
            <input
              type="date"
              value={coverageDate}
              onChange={(event) => setCoverageDate(event.target.value)}
              className="w-full rounded-xl border border-line bg-white px-4 py-4 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={
              message.toLowerCase().includes('success') || message.toLowerCase().includes('completed')
                ? 'mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800'
                : 'mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800'
            }
          >
            {message.toLowerCase().includes('success') || message.toLowerCase().includes('completed') ? (
              <CheckCircle2 className="mr-2 inline" size={18} />
            ) : null}
            {message}
          </div>
        )}

        {/* Buttons */}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={clearForm}>
            Clear
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={validatePreview}
          >
            Validate & preview sync
          </button>

          <button
            type="button"
            className="btn"
            disabled={true}
            title="Disabled until the confirmation API has been secured and tested"
            onClick={confirmSync}
          >
            Confirm sync & activate
          </button>
        </div>
      </div>

      {/* Synchronization preview */}
      {preview && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Synchronization preview</h2>
              <p className="mt-2 text-muted">
                Staging comparison for the uploaded snapshot file.
              </p>
            </div>

            <span className="pill pill-gray">Preview only</span>
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-stone-50 p-5">
            <p className="text-sm text-muted">FILE</p>
            <p className="font-bold">{fileName}</p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <PreviewCard
              label="Existing records"
              value={`${syncResult?.existingRecords ?? 0} claims`}
            />
            <PreviewCard
              label="New claims"
              value={`+${syncResult?.newRecords ?? 0}`}
            />
            <PreviewCard
              label="Updated records"
              value={`${syncResult?.updatedRecords ?? 0}`}
            />
            <PreviewCard
              label="Unchanged records"
              value={`${syncResult?.unchangedRecords ?? 0}`}
            />
            <PreviewCard
              label="Duplicates blocked"
              value={`${syncResult?.duplicates ?? 0}`}
            />
          </div>

        </div>
      )}

      {/* Read-only comparison table from the Part 1 preview API response */}
      {preview && Array.isArray(syncResult?.parsedRecords) && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Claim comparison preview</h2>
              <p className="mt-2 text-muted">
                Review uploaded claims before synchronization. This table does not modify the database.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Status
              <select
                className="rounded-xl border border-line bg-white px-3 py-2"
                value={comparisonFilter}
                onChange={(event) => setComparisonFilter(event.target.value)}
              >
                <option value="ALL">All</option>
                <option value="NEW_RECORD">New</option>
                <option value="EXISTING_UPDATE">Updated</option>
                <option value="UNCHANGED">Unchanged</option>
                <option value="DUPLICATE">Duplicate</option>
              </select>
            </label>
          </div>
          <p className="mt-3 text-sm text-muted">
            {syncResult.parsedRecords.filter((row: any) =>
              comparisonFilter === 'ALL' || row._status === comparisonFilter
            ).length} of {syncResult.parsedRecords.length} uploaded rows shown
          </p>
          <div className="mt-4 max-h-[560px] overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[1160px] text-left text-sm">
              <thead className="sticky top-0 bg-stone-50">
                <tr>
                  <th className="p-3">Claim No</th>
                  <th className="p-3">Client Name</th>
                  <th className="p-3">DOB</th>
                  <th className="p-3">Gender</th>
                  <th className="p-3">Incident Date</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Changed Fields</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {syncResult.parsedRecords
                  .filter((row: any) => comparisonFilter === 'ALL' || row._status === comparisonFilter)
                  .map((row: any, index: number) => (
                    <tr key={`${row.claimNo ?? 'unknown'}-${index}`} className="border-t border-line align-top">
                      <td className="p-3 font-semibold">{String(row.claimNo ?? '—')}</td>
                      <td className="p-3">{String(row.clientName ?? '—')}</td>
                      <td className="p-3">{String(row.dateOfBirth ?? '—')}</td>
                      <td className="p-3">{String(row.gender ?? '—')}</td>
                      <td className="p-3">{String(row.incidentDate ?? '—')}</td>
                      <td className="max-w-[280px] p-3 break-words">{String(row.description ?? '—')}</td>
                      <td className="p-3 font-semibold">{
                        ({
                          NEW_RECORD: 'New',
                          EXISTING_UPDATE: 'Updated',
                          UNCHANGED: 'Unchanged',
                          DUPLICATE: 'Duplicate',
                        } as Record<string, string>)[row._status] ?? String(row._status ?? '—')
                      }</td>
                      <td className="p-3">{
                        Array.isArray(row._changedFields) && row._changedFields.length > 0
                          ? row._changedFields.join(', ')
                          : '—'
                      }</td>
                      <td className="p-3">
                        <button type="button" className="text-brand font-semibold underline" onClick={() => setSelectedClaim(row)}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">
            Comparison covers client name, date of birth, gender, incident date, and description only.
            Claim number is the record identifier. No data is changed by this preview.
          </p>
        </div>
      )}

      {/* Compare old vs uploaded values; entirely read-only */}
      {selectedClaim && (
        <div className="card" role="region" aria-label="Claim comparison details">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Claim Details: {String(selectedClaim.claimNo ?? '—')}</h2>
              <p className="mt-2 text-sm text-muted">Existing database values vs uploaded Excel. Only the five mapped fields are compared.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setSelectedClaim(null)}>Close</button>
          </div>
          {selectedClaim._status === 'DUPLICATE' && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
              Duplicate claim number: this row is blocked. It may match multiple uploaded rows or existing database records.
            </p>
          )}
          {!selectedClaim._existingValues && (
            <p className="mt-4 text-muted">No unique existing database record is available for comparison.</p>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead><tr>
                <th className="p-3 text-left">Field</th>
                <th className="p-3 text-left">Existing Supabase</th>
                <th className="p-3 text-left">Uploaded Excel</th>
                <th className="p-3 text-left">Result</th>
              </tr></thead>
              <tbody>
                {([
                  ['client_name', 'Client Name', 'clientName'],
                  ['date_of_birth', 'Date of Birth', 'dateOfBirth'],
                  ['gender', 'Gender', 'gender'],
                  ['incident_date', 'Incident Date', 'incidentDate'],
                  ['description', 'Description / Diagnosis', 'description'],
                ] as const).map(([field, label, key]) => {
                  const changed = Array.isArray(selectedClaim._changedFields) && selectedClaim._changedFields.includes(field)
                  return (
                    <tr key={field} className={`border-t border-line ${changed ? 'bg-amber-50' : ''}`}>
                      <td className="p-3 font-semibold">{label}</td>
                      <td className="p-3 break-words">{selectedClaim._existingValues ? String(selectedClaim._existingValues[field] ?? '—') : '—'}</td>
                      <td className="p-3 break-words">{String(selectedClaim[key] ?? '—')}</td>
                      <td className="p-3">{selectedClaim._status === 'DUPLICATE' ? 'Review duplicate' : !selectedClaim._existingValues ? 'New record' : changed ? 'Changed' : 'Same'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Synchronization history */}
      <div className="card">
        <h2 className="text-2xl font-bold">Database synchronization history</h2>
        <p className="mt-2 text-muted">
          Audit history for activated historical snapshots.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Version</th>
                <th>Claims covered through</th>
                <th>Status</th>
                <th>Method</th>
                <th>Updated by</th>
                <th>Updated on</th>
              </tr>
            </thead>
            <tbody>
              {syncHistory.map((item, index) => (
                <tr key={`${item.version}-${index}`}>
                  <td>{item.version}</td>
                  <td>{item.coverageDate}</td>
                  <td>
                    <span
                      className={
                        item.status === 'Active'
                          ? 'pill pill-green'
                          : 'pill pill-gray'
                      }
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>{item.method}</td>
                  <td>{item.updatedBy}</td>
                  <td>{item.updatedOn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

/* -----------------------------------------
   Small reusable components
----------------------------------------- */

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-stone-50 p-5">
      <p className="text-sm uppercase text-muted">{label}</p>
      <p className="mt-2 font-bold">{value}</p>
    </div>
  )
}

function PreviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm uppercase text-muted">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  )
}
