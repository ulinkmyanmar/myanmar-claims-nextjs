"use client"

import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'

interface SyncHistoryItem {
  id?: number
  version: string
  coverage_date: string
  status: string
  method: string
  updated_by: string
  createddatetime?: string
  created_at?: string
}

export default function DatabaseManagementPage() {
  const [historyList, setHistoryList] = useState<SyncHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  // 1. 从 API 获取最新历史记录（禁用缓存，保证每次进页面都是最新的）
  const fetchHistory = async () => {
    try {
      setLoading(true)
      // 加上 cache: 'no-store' 彻底禁用 Next.js 路由缓存
      const res = await fetch('/api/database-sync/history', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setHistoryList(data)
        } else {
          // 如果 Supabase 里为空，显示默认初始快照
          setHistoryList([
            {
              version: 'Claims History 2022 – Jun 2026',
              coverage_date: '30-Jun-2026',
              status: 'Active',
              method: 'Initial snapshot',
              updated_by: 'Admin Myanmar',
              createddatetime: 'Initial snapshot',
            },
          ])
        }
      }
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setLoading(false)
    }
  }

  // 组件挂载时自动抓取
  useEffect(() => {
    fetchHistory()
  }, [])

  // 辅助函数：格式化显示时间
  const formatTime = (timeStr?: string) => {
    if (!timeStr || timeStr === 'Initial snapshot') return 'Initial snapshot'
    const date = new Date(timeStr)
    return isNaN(date.getTime())
      ? timeStr
      : date.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ... 页面的上半部分：Validation checklist 等区域保持不变 ... */}

        {/* Database synchronization history */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Database synchronization history</h2>
          <p className="mt-1 text-sm text-stone-500">
            Audit history for activated historical snapshots.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-3">VERSION</th>
                  <th className="px-4 py-3">CLAIMS COVERED THROUGH</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3">METHOD</th>
                  <th className="px-4 py-3">UPDATED BY</th>
                  <th className="px-4 py-3">UPDATED ON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                      Loading synchronization history...
                    </td>
                  </tr>
                ) : (
                  historyList.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-stone-50/50">
                      <td className="px-4 py-4 font-medium text-stone-900">
                        {item.version}
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        {item.coverage_date}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-stone-600">{item.method}</td>
                      <td className="px-4 py-4 text-stone-600">{item.updated_by}</td>
                      <td className="px-4 py-4 text-stone-600">
                        {formatTime(item.createddatetime || item.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
