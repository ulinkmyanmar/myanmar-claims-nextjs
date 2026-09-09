"use client"

import { useRef, useState } from "react"
import * as XLSX from "xlsx"
import { Download, Upload } from "lucide-react"

type CensusRow = {
  name: string
  nrc: string
  dob: string
  gender: string
}

const TEMPLATE_HEADERS = [
  "Name",
  "NRC / National ID",
  "Date of Birth",
  "Gender",
]

export default function BulkCensusClient() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<CensusRow[]>([])
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")

  function downloadTemplate() {
    const data = [
      {
        Name: "Example Member",
        "NRC / National ID": "12/ABC(N)123456",
        "Date of Birth": "1990-01-01",
        Gender: "Female",
      },
    ]

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Census Template"
    )

    XLSX.writeFile(
      workbook,
      "Ulink_Myanmar_Census_Template.xlsx"
    )
  }

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]

    if (!file) return

    setError("")
    setRows([])
    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()

      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      })

      const firstSheetName = workbook.SheetNames[0]

      if (!firstSheetName) {
        setError("The Excel file does not contain a worksheet.")
        return
      }

      const worksheet =
        workbook.Sheets[firstSheetName]

      const rawRows =
        XLSX.utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          {
            defval: "",
            raw: false,
          }
        )

      if (rawRows.length === 0) {
        setError("The Excel file does not contain any data.")
        return
      }

      const firstRow = rawRows[0]

      const headers = Object.keys(firstRow)

      const findHeader = (target: string) => {
        return headers.find(
          (header) =>
            header.trim().toLowerCase() ===
            target.trim().toLowerCase()
        )
      }

      const nameHeader = findHeader("Name")
      const nrcHeader = findHeader("NRC / National ID")
      const dobHeader = findHeader("Date of Birth")
      const genderHeader = findHeader("Gender")

      const missingHeaders: string[] = []

      if (!nameHeader) {
        missingHeaders.push("Name")
      }

      if (!nrcHeader) {
        missingHeaders.push("NRC / National ID")
      }

      if (!dobHeader) {
        missingHeaders.push("Date of Birth")
      }

      if (!genderHeader) {
        missingHeaders.push("Gender")
      }

      if (missingHeaders.length > 0) {
        setError(
          `Missing required column(s): ${missingHeaders.join(", ")}`
        )
        return
      }

      const parsedRows: CensusRow[] = rawRows.map((row) => ({
        name: String(row[nameHeader!] ?? "").trim(),
        nrc: String(row[nrcHeader!] ?? "").trim(),
        dob: String(row[dobHeader!] ?? "").trim(),
        gender: String(row[genderHeader!] ?? "").trim(),
      }))

      setRows(parsedRows)
    } catch (err) {
      console.error(err)

      setError(
        "Unable to read this file. Please upload a valid Excel or CSV file."
      )
    }

    event.target.value = ""
  }

  return (
    <div className="mt-6">

      <div className="flex flex-wrap gap-3">

        <button
          type="button"
          className="btn-secondary"
          onClick={downloadTemplate}
        >
          <Download size={18} />
          Download Standardized Template
        </button>

        <button
          type="button"
          className="btn"
          onClick={openFilePicker}
        >
          <Upload size={18} />
          Upload Excel File
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileChange}
        />

      </div>


      {fileName && (
        <div className="mt-4 rounded-xl border border-line bg-blue-50 p-4">
          <p className="font-semibold">
            Uploaded file
          </p>

          <p className="text-muted">
            {fileName}
          </p>

          <p className="mt-1 text-sm text-muted">
            {rows.length} member(s) loaded
          </p>
        </div>
      )}


      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}


      {rows.length > 0 && (
        <div className="mt-6 overflow-x-auto">

          <table className="w-full">

            <thead>
              <tr>
                <th>Uploaded Member</th>
                <th>NRC / National ID</th>
                <th>DOB</th>
                <th>Gender</th>
                <th>Status</th>
                <th>Historical Member ID</th>
              </tr>
            </thead>

            <tbody>

              {rows.map((row, index) => (

                <tr key={index}>

                  <td>
                    {row.name || "—"}
                  </td>

                  <td>
                    {row.nrc || "—"}
                  </td>

                  <td>
                    {row.dob || "—"}
                  </td>

                  <td>
                    {row.gender || "—"}
                  </td>

                  <td>
                    <span className="pill pill-gray">
                      Pending
                    </span>
                  </td>

                  <td>
                    —
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>
      )}

    </div>
  )
}