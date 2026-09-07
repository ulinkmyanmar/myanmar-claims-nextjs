import AppShell from '@/components/AppShell'
import DashboardQuickSearch from '@/components/DashboardQuickSearch'
import { Database, User, FileText, Search } from 'lucide-react'
import { COVERAGE_DATE, CURRENT_VERSION } from '@/lib/constants'
import { demoMembers, demoClaims } from '@/lib/demo-data'

export default function Dashboard() {
  return (
    <AppShell title="Dashboard" subtitle="Claims History Checking System">
      <section className="grid gap-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <b>Current claims snapshot:</b> Historical claims are covered through{' '}
          <b>{COVERAGE_DATE}</b>. Claims approved after this date will appear only after the next
          manual database refresh.
        </div>

        <div className="card">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-brand">
            <Search size={20} />
          </div>
          <h2 className="text-xl font-bold">Search Member Claims History</h2>
          <p className="mt-2 text-muted">
            Search by name, NRC / National ID, date of birth, gender, or any partial combination.
          </p>
          <DashboardQuickSearch />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            icon={Database}
            label="Current database version"
            value={CURRENT_VERSION}
            note="Current slim/indexed historical claims snapshot used for searches."
          />
          <StatCard
            icon={User}
            label="Demo members"
            value={String(demoMembers.length)}
            note="Dummy data only in this prototype."
          />
          <StatCard
            icon={FileText}
            label="Demo claims"
            value={String(demoClaims.length)}
            note="Full claims history is grouped by member."
          />
        </div>
      </section>
    </AppShell>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: any
  label: string
  value: string
  note: string
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <p className="text-muted">{label}</p>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-brand">
          <Icon size={18} />
        </div>
      </div>
      <b className="mt-2 block text-2xl">{value}</b>
      <p className="mt-2 text-sm text-muted">{note}</p>
    </div>
  )
}