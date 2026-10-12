import AppShell from '@/components/AppShell'
import BulkCensusClient from '@/components/BulkCensusClient'

export default function BulkCensusPage() {
  return (
    <AppShell>

      <section className="card">

        <h1 className="text-2xl font-bold">
          Bulk Census Checking
        </h1>

        <BulkCensusClient />

      </section>

    </AppShell>
  )
}
