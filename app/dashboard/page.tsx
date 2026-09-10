import Link from 'next/link'
import { Search, Database, Users, FileText } from 'lucide-react'

import AppShell from '@/components/AppShell'
import { COVERAGE_DATE, CURRENT_VERSION } from '@/lib/constants'
import { createClient } from '@supabase/supabase-js'

// 服务端直接查询 Supabase 数据
async function getDashboardStats() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. 查询理赔总数
    const { count: claimsCount } = await supabase
      .schema('MyanmarClaimSystem')
      .from('mcs_claims')
      .select('*', { count: 'exact', head: true })

    // 2. 查询最新同步历史
    const { data: latestSync } = await supabase
      .schema('MyanmarClaimSystem')
      .from('mcs_database_sync_history')
      .select('*')
      .order('createddatetime', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      totalClaims: claimsCount ?? 0,
      latestVersion: latestSync?.version || CURRENT_VERSION,
      coverageDate: latestSync?.coverage_date || COVERAGE_DATE,
    }
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    return {
      totalClaims: 0,
      latestVersion: CURRENT_VERSION,
      coverageDate: COVERAGE_DATE,
    }
  }
}

export default async function Dashboard() {
  // 服务端直接异步获取统计数据
  const stats = await getDashboardStats()

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
            <strong>{stats.coverageDate}</strong>.
            Claims approved after this date will appear only after the next manual database refresh.
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
              Search by name, NRC / National ID, date of birth, gender, or any partial combination.
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
              Replace the current claims snapshot when a new slim/indexed claims file is prepared.
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
                  {stats.latestVersion}
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

          {/* Active Claims Records */}
          <div className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted">
                  Total Active Claims
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {stats.totalClaims}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand">
                <FileText size={22} />
              </div>
            </div>

            <p className="mt-5 text-sm text-muted">
              Live claims synchronized in Supabase database.
            </p>
          </div>

          {/* Status */}
          <div className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted">
                  Database Status
                </p>

                <p className="mt-2 text-2xl font-bold text-green-600">
                  Connected
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand">
                <Users size={22} />
              </div>
            </div>

            <p className="mt-5 text-sm text-muted">
              Real-time integration with Supabase backend.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
