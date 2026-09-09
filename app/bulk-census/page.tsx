import AppShell from '@/components/AppShell'
import BulkCensusClient from '@/components/BulkCensusClient'

export default function BulkCensusPage() {
  return (
    <AppShell>

      <section className="card">

        <h1 className="text-2xl font-bold">
          Bulk Census Checking
        </h1>

        <p className="mt-2 text-muted">
          Phase 2 module for standardized .xlsx census upload and batch matching.
        </p>


        <BulkCensusClient />


        <div className="mt-8 rounded-2xl border border-line bg-stone-50 p-6">

          <b>
            Planned workflow
          </b>

          <p className="mt-2 text-muted">
            Insurer Census File → Convert into Ulink Standardized Template → Upload → System checks every member → Bulk Result Table → Click row for member detail.
          </p>

        </div>

      </section>

    </AppShell>
  )
}
