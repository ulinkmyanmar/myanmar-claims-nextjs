import AppShell from '@/components/AppShell'
import DashboardSearch from '@/components/DashboardSearch'
import { COVERAGE_DATE, CURRENT_VERSION } from '@/lib/constants'


export default function Dashboard() {

  return (

    <AppShell>

      <section className="grid gap-6">

        <div>
          <h1 className="text-3xl font-bold">
            Myanmar Claims History Checking System
          </h1>

          <p className="text-muted mt-2">
            Historical claims covered through {COVERAGE_DATE}
          </p>

          <p className="text-sm text-muted mt-1">
            System Version: {CURRENT_VERSION}
          </p>
        </div>


        <DashboardSearch />


        <div className="grid gap-4 md:grid-cols-3">

          <Metric
            label="Total Claims"
            value="0"
          />

          <Metric
            label="Pending Review"
            value="0"
          />

          <Metric
            label="Completed"
            value="0"
          />

        </div>


      </section>

    </AppShell>

  )
}



function Metric({
  label,
  value
}: {
  label: string
  value: string
}) {

  return (

    <div className="card">

      <p className="text-muted">
        {label}
      </p>

      <b className="mt-2 block text-2xl">
        {value}
      </b>

    </div>

  )

}