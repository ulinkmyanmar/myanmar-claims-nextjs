
import AppShell from '@/components/AppShell'
import SearchClient from './SearchClient'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams
  return (
    <AppShell title="Search claims" subtitle="Claims History Checking System">
      <SearchClient initialQuery={params.q} />
    </AppShell>
  )
}