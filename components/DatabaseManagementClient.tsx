"use client"

import { useEffect, useRef, useState } from 'react'
import {
  Upload,
  CheckCircle2,
  FileSpreadsheet,
  Archive,
  GitCompare,
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
        const res = await fetch('/api/database-sync/history')
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
      setValidated(true)
      setPreview(true)
      setMessage('Validation preview completed successfully. Ready for confirmation.')
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
      const safeRecords = (syncResult.parsedRecords || []).map((row: any) => {
        return {
          memberId: String(row["Historical Member ID"] || row["Member ID"] || row["ID"] || "").trim(),
          clientName: String(row["Preferred Full Name"] || row["Client Name"] || row["Name"] || "").trim(),
          dateOfBirth: row["Date of Birth"] ? String(row["Date of Birth"]).trim() : null,
          gender: row["Gender"] ? String(row["Gender"]).trim() : null,
          claimNo: row["Claim No"] ? String(row["Claim No"]).trim() : "",
        }
      })

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
        `Synchronization confirmed! Database has been updated with ${syncResult.newRecords ?? safeRecords.length} new records.`
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
          <div className="mb-3 inline-flex items-center rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-muted">
            Phase 3 preview
          </div>
          <h1 className="text-4xl font-bold">
            Historical database synchronization
          </h1>
          <p className="mt-2 max-w-4xl text-lg text-muted">
            Upload the latest full slim/indexed claims snapshot, validate it in staging, then synchronize the live historical database.
          </p>
        </div>

        <div className="rounded-full border border-amber-300 bg-amber-50 px-5 py-3 font-semibold text-amber-800">
          Admin only
        </div>
      </div>

      {/* Recommended approach */}
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <p className="leading-7 text-amber-900">
          <strong>Recommended Phase 3 approach:</strong> Do not blindly delete the database and do not append every row without checking. Treat the latest full slim/indexed file as the authoritative snapshot, compare it with the active database, insert new records, update corrected records, keep unchanged records, block duplicates, and archive the previous version for rollback.
        </p>
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

      {/* Four steps */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StepCard
          number="1"
          icon={<FileSpreadsheet size={24} />}
          title="Prepare full snapshot"
          description="Download the latest approved raw claims and convert the complete history into the standard slim/indexed format."
        />
        <StepCard
          number="2"
          icon={<Upload size={24} />}
          title="Upload to staging"
          description="The new file is loaded into a temporary staging area first, without changing the active database."
        />
        <StepCard
          number="3"
          icon={<GitCompare size={24} />}
          title="Compare and synchronize"
          description="Insert new claims, update corrected records, retain unchanged rows, and prevent duplicate claims."
        />
        <StepCard
          number="4"
          icon={<Archive size={24} />}
          title="Activate and archive"
          description="Activate the synchronized snapshot only after validation and keep the previous version available for rollback."
        />
      </div>

      {/* Upload section */}
      <div className="card">
        <h2 className="text-2xl font-bold">Upload new full claims snapshot</h2>
        <p className="mt-2 text-muted">
          Phase 3 workflow. The uploaded file should contain the complete historical snapshot, including the newest approved claims.
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
            disabled={!validated}
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

            <span className="pill pill-green">Ready for confirmation</span>
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

          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-5">
            <p className="text-green-900">
              <strong>Controlled sync:</strong> The active database changes only after confirmation. The previous snapshot is archived so the administrator can roll back if the new import is incomplete or incorrect.
            </p>
          </div>
        </div>
      )}

      {/* Validation checklist */}
      <div className="card">
        <h2 className="text-2xl font-bold">Validation checklist</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <CheckItem>Required columns</CheckItem>
          <CheckItem>Total rows / unique members / unique claims</CheckItem>
          <CheckItem>Duplicate claim numbers</CheckItem>
          <CheckItem>Missing identifiers and invalid dates</CheckItem>
          <CheckItem>Changed records</CheckItem>
          <CheckItem>New records</CheckItem>
        </div>
      </div>

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

function StepCard({
  number,
  icon,
  title,
  description,
}: {
  number: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-brand">
          {icon}
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-brand">
          {number}
        </span>
      </div>

      <h3 className="mt-5 text-xl font-bold">{title}</h3>
      <p className="mt-3 leading-7 text-muted">{description}</p>
    </div>
  )
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-stone-50 p-4">
      <CheckCircle2 size={20} className="shrink-0 text-green-600" />
      <span className="font-medium">{children}</span>
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
