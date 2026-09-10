import Link from 'next/link'
import { Search, Database, Users, FileText } from 'lucide-react'

import AppShell from '@/components/AppShell'
import { COVERAGE_DATE, CURRENT_VERSION } from '@/lib/constants'


export default function Dashboard() {
  return (
    <AppShell>

      <section className="grid gap-6">

        {/* Page heading */}
        <div>
          <h1 className="text-3xl font-bold">
            Welcome, Myanmar Admin
          </h1>

          <p className="mt-2 text-muted">
            Search the current historical claims snapshot, or manage the periodic slim/indexed database replacement.
          </p>
        </div>


        {/* Current claims snapshot */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">

          <p className="text-amber-900">
            <strong>Current claims snapshot:</strong>{' '}
            Historical claims are covered through{' '}
            <strong>{COVERAGE_DATE}</strong>.
            Claims approved after this date will appear only after
            the next manual database refresh.
          </p>

        </div>


        {/* Main actions */}
        <div className="grid gap-5 md:grid-cols-2">

          {/* Search Member */}
          <Link
            href="/search"
            className="card block transition hover:-translate-y-0.5 hover:shadow-md"
          >

            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand">
              <Search size={26} />
            </div>

            <h2 className="text-xl font-bold">
              Search Member Claims History
            </h2>

            <p className="mt-2 text-muted">
              Search by name, NRC / National ID, date of birth,
              gender, or any partial combination.
            </p>

            <div className="mt-5 font-bold text-brand">
              Start search →
            </div>

          </Link>


          {/* Database Management */}
          <Link
            href="/database-management"
            className="card block transition hover:-translate-y-0.5 hover:shadow-md"
          >

            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand">
              <Database size={26} />
            </div>

            <h2 className="text-xl font-bold">
              Historical Database Management
            </h2>

            <p className="mt-2 text-muted">
              Replace the current claims snapshot when a new
              slim/indexed claims file is prepared.
            </p>

            <div className="mt-5 font-bold text-brand">
              Manage database →
            </div>

          </Link>

        </div>


        {/* Dashboard statistics */}
        <div className="grid gap-5 md:grid-cols-3">

          {/* Database version */}
          <div className="card">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-sm text-muted">
                  Current database version
                </p>

                <p className="mt-2 text-xl font-bold">
                  {CURRENT_VERSION}
                </p>

              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand">
                <Database size={22} />
              </div>

            </div>

            <p className="mt-5 text-sm text-muted">
              Periodic slim/indexed historical claims snapshot.
            </p>

          </div>


          {/* Demo members */}
          <div className="card">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-sm text-muted">
                  Demo members
                </p>

                <p className="mt-2 text-4xl font-bold">
                  3
                </p>

              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand">
                <Users size={22} />
              </div>

            </div>

            <p className="mt-5 text-sm text-muted">
              Dummy data only in this prototype.
            </p>

          </div>


          {/* Demo claims */}
          <div className="card">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-sm text-muted">
                  Demo claims
                </p>

                <p className="mt-2 text-4xl font-bold">
                  5
                </p>

              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand">
                <FileText size={22} />
              </div>

            </div>

            <p className="mt-5 text-sm text-muted">
              Full claims history is grouped by member.
            </p>

          </div>

        </div>

      </section>

    </AppShell>
  )
}
