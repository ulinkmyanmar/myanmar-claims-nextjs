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
        "Unable to read this file. Please upload a
