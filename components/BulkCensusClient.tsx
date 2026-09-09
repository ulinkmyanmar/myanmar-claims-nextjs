"use client"

import { useRef, useState } from "react"
import * as XLSX from "xlsx"
import { Download, Upload, Search, X } from "lucide-react"

type ClaimRecord = {
  [key: string]: unknown
}

type CensusRow = {
  name: string
  nrc: string
  dob: string
  gender: string
  status: "Matched" | "No history" | "Pending"
  claims: ClaimRecord[]
}

const SAMPLE_ROWS: CensusRow[] = [
  {
    name: "Yoon Thadar Htun",
    nrc: "12/ABC(N)123456",
    dob: "11-Jul-1918",
    gender: "Female",
    status: "Matched",
    claims: [
      {
        id: "HM0000001",
        claim_no: "SAMPLE-0001",
        client_name: "Yoon Thadar Htun",
        passport_no: "12/ABC(N)123456",
      },
    ],
  },
  {
    name: "Thiri Mon",
    nrc: "",
    dob: "08-Feb-1997",
    gender: "Female",
    status: "No history",
    claims: [],
  },
  {
    name: "Aung Min Khant",
    nrc: "9/MABANA(N)765432",
    dob: "22-Mar-1987",
    gender: "Male",
    status: "Matched",
    claims: [
      {
        id: "HM0000002",
        claim_no: "SAMPLE-0002",
        client_name: "Aung Min Khant",
        passport_no: "9/MABANA(N)765432",
      },
    ],
  },
]

export default function BulkCensusClient() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<CensusRow[]>([])
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [showSample, setShowSample] = useState(false)
  const [selectedRow, setSelectedRow] = useState<CensusRow | null>(null)
  const [searching, setSearching] = useState(false)

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

  function loadSampleResult() {
    setError("")
    setFileName("")
    setSelectedRow(null)
    setShowSample(true)
    setRows(SAMPLE_ROWS)
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
    setSelectedRow(null)
    setShowSample(false)
    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()

      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      })

      const firstSheetName = workbook.SheetNames[0]

      if (!firstSheetName) {
        setError(
          "The Excel file does not contain a worksheet."
        )
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
        setError(
          "The Excel file does not contain any data."
        )
        return
      }

      const headers = Object.keys(rawRows[0])

      const findHeader = (target: string) =>
        headers.find(
          (header) =>
            header.trim().toLowerCase() ===
            target.trim().toLowerCase()
        )

      const nameHeader =
        findHeader("Name")

      const nrcHeader =
        findHeader("NRC / National ID")

      const dobHeader =
        findHeader("Date of Birth")

      const genderHeader =
        findHeader("Gender")

      const missingHeaders: string[] = []

      if (!nameHeader) {
        missingHeaders.push("Name")
      }

      if (!nrcHeader) {
        missingHeaders.push(
          "NRC / National ID"
        )
      }

      if (!dobHeader) {
        missingHeaders.push(
          "Date of Birth"
        )
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

      const parsedRows: CensusRow[] =
        rawRows.map((row) => ({
          name: String(
            row[nameHeader!] ?? ""
          ).trim(),

          nrc: String(
            row[nrcHeader!] ?? ""
          ).trim(),

          dob: String(
            row[dobHeader!] ?? ""
          ).trim(),

          gender: String(
            row[genderHeader!] ?? ""
          ).trim(),

          status: "Pending",

          claims: [],
        }))

      setRows(parsedRows)

      /*
       * Send the uploaded members to the server
       * for matching against mcs_claims.
       */
      setSearching(true)

      const response = await fetch(
        "/api/bulk-census",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            rows: parsedRows.map(
              ({
                name,
                nrc,
                dob,
                gender,
              }) => ({
                name,
                nrc,
                dob,
                gender,
              })
            ),
          }),
        }
      )

      const result =
        await response.json()

      if (!response.ok) {
        setError(
          result.error ??
            "Unable to check census records."
        )
        return
      }

      setRows(result.results ?? [])
    } catch (err) {
      console.error(err)

      setError(
        "Unable to read this file. Please upload a valid Excel file."
      )
    } finally {
      setSearching(false)
      event.target.value = ""
    }
  }

  return (
    <div className="mt-6">

      {/* Upload / Download */}
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


      {/* Sample result */}
      <div className="mt-8 rounded-3xl border border-line bg-white p-6">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>
            <h2 className="text-xl font-bold">
              Sample bulk result
            </h2>

            <p className="mt-2 text-muted">
              Click any member row to view census details and available historical claims.
            </p>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={loadSampleResult}
          >
            Load sample result
          </button>

        </div>


        {showSample && (
          <div className="mt-6 overflow-x-auto">

            <table className="w-full">

              <thead>
                <tr>
                  <th>Uploaded Member</th>
                  <th>NRC / National ID</th>
                  <th>Date of Birth</th>
                  <th>Gender</th>
                  <th>Match Status</th>
                  <th>Claim No</th>
                </tr>
              </thead>

              <tbody>

                {SAMPLE_ROWS.map(
                  (row, index) => {

                    const firstClaim =
                      row.claims[0]

                    return (
                      <tr
                        key={index}
                        className="cursor-pointer hover:bg-blue-50"
                        onClick={() =>
                          setSelectedRow(row)
                        }
                      >

                        <td>
                          <div className="font-semibold">
                            {row.name}
                          </div>

                          <button
                            type="button"
                            className="mt-1 text-sm font-semibold text-brand"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedRow(row)
                            }}
                          >
                            View details
                          </button>
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
                          <span
                            className={
                              row.status === "Matched"
                                ? "pill pill-green"
                                : "pill pill-gray"
                            }
                          >
                            {row.status}
                          </span>
                        </td>

                        <td>
                          {typeof firstClaim?.claim_no === "string"
                            ? firstClaim.claim_no
                            : "—"}
                        </td>

                      </tr>
                    )
                  }
                )}

              </tbody>

            </table>

          </div>
        )}

      </div>


      {/* Uploaded file information */}
      {fileName && (
        <div className="mt-6 rounded-xl border border-line bg-blue-50 p-4">

          <p className="font-semibold">
            Uploaded file
          </p>

          <p className="text-muted">
            {fileName}
          </p>

          <p className="mt-1 text-sm text-muted">
            {rows.length} member(s) loaded
          </p>

          {searching && (
            <p className="mt-2 text-sm font-semibold text-brand">
              Checking historical claims...
            </p>
          )}

        </div>
      )}


      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}


      {/* Real uploaded result */}
      {rows.length > 0 && !showSample && (
        <div className="mt-6">

          <h2 className="mb-3 text-xl font-bold">
            Bulk Result
          </h2>

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>
                <tr>
                  <th>Uploaded Member</th>
                  <th>NRC / National ID</th>
                  <th>DOB</th>
                  <th>Gender</th>
                  <th>Match Status</th>
                  <th>Claim No</th>
                  <th>Claims</th>
                </tr>
              </thead>

              <tbody>

                {rows.map(
                  (row, index) => {

                    const firstClaim =
                      row.claims?.[0]

                    const claimNo =
                      firstClaim &&
                      typeof firstClaim.claim_no === "string"
                        ? firstClaim.claim_no
                        : "—"

                    return (
                      <tr
                        key={index}
                        className="cursor-pointer hover:bg-blue-50"
                        onClick={() =>
                          setSelectedRow(row)
                        }
                      >

                        <td>
                          <div className="font-semibold">
                            {row.name || "—"}
                          </div>

                          <button
                            type="button"
                            className="mt-1 text-sm font-semibold text-brand"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedRow(row)
                            }}
                          >
                            View details
                          </button>
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
                          <span
                            className={
                              row.status === "Matched"
                                ? "pill pill-green"
                                : "pill pill-gray"
                            }
                          >
                            {row.status}
                          </span>
                        </td>

                        <td>
                          {claimNo}
                        </td>

                        <td>
                          {row.claims?.length ?? 0}
                        </td>

                      </tr>
                    )
                  }
                )}

              </tbody>

            </table>

          </div>

        </div>
      )}


      {/* Details panel */}
      {selectedRow && (
        <div className="mt-6 rounded-3xl border border-line bg-white p-6">

          <div className="flex items-center justify-between">

            <h2 className="text-xl font-bold">
              Member Details
            </h2>

            <button
              type="button"
              className="rounded-full p-2 hover:bg-gray-100"
              onClick={() =>
                setSelectedRow(null)
              }
            >
              <X size={20} />
            </button>

          </div>


          <div className="mt-5 grid gap-4 md:grid-cols-2">

            <div>
              <p className="text-sm text-muted">
                Uploaded Member
              </p>

              <p className="font-semibold">
                {selectedRow.name || "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted">
                NRC / National ID
              </p>

              <p className="font-semibold">
                {selectedRow.nrc || "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted">
                Date of Birth
              </p>

              <p className="font-semibold">
                {selectedRow.dob || "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted">
                Gender
              </p>

              <p className="font-semibold">
                {selectedRow.gender || "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted">
                Match Status
              </p>

              <span
                className={
                  selectedRow.status === "Matched"
                    ? "pill pill-green"
                    : "pill pill-gray"
                }
              >
                {selectedRow.status}
              </span>
            </div>

          </div>


          {/* Matching claims */}
          <div className="mt-8">

            <h3 className="text-lg font-bold">
              Historical Claims
            </h3>

            {selectedRow.claims?.length === 0 ? (

              <div className="mt-3 rounded-xl border border-line bg-stone-50 p-4 text-muted">
                No historical claims found.
              </div>

            ) : (

              <div className="mt-3 grid gap-4">

                {selectedRow.claims.map(
                  (claim, index) => (

                    <div
                      key={index}
                      className="rounded-xl border border-line bg-stone-50 p-4"
                    >

                      <div className="mb-3 flex items-center gap-2">

                        <Search size={18} />

                        <b>
                          Claim Record {index + 1}
                        </b>

                      </div>


                      <div className="grid gap-3 md:grid-cols-2">

                        {Object.entries(
                          claim
                        ).map(
                          ([key, value]) => (

                            <div key={key}>

                              <p className="text-xs uppercase text-muted">
                                {key.replaceAll(
                                  "_",
                                  " "
                                )}
                              </p>

                              <p className="font-semibold">
                                {String(
                                  value ?? "—"
                                )}
                              </p>

                            </div>

                          )
                        )}

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </div>

        </div>
      )}

    </div>
  )
}
