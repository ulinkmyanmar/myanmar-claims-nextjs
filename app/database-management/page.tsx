"use client"

import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'

// 定义历史记录的数据结构
interface SyncHistoryItem {
  id?: number
  version: string
  coverage_date: string
  status: string
  method: string
  updated_by: string
  createddatetime?: string
}

export default function DatabaseManagementPage() {
  // 1. 初始化 state，默认为空或加载状态
  const [historyList, setHistoryList] = useState<SyncHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  // 2. 封装从 API 获取历史记录的函数
  const fetchSyncHistory = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/database-sync/history')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setHistoryList(data)
        } else {
          // 兜底保底数据
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
    } catch (error) {
      console.error('Failed to fetch sync history:', error)
    } finally {
      setLoading(false)
    }
  }

  // 3. 页面挂载时自动拉取 Supabase 数据库里的最新历史
  useEffect(() => {
    fetchSyncHistory()
  }, [])

  // 处理同步成功后的回调（重新拉取数据库）
  const handleSyncSuccess = () => {
    fetchSyncHistory()
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* 页面上方：Validation checklist & 上传区域 */}
        {/* ...（保持你原有的上传组件和 Checklist 逻辑）... */}

        {/* 下方：Database synchronization history 列表 */}
        <div className="card">
          <h2 className="text-xl font-bold">Database synchronization history</h2>
          <p className="text-sm text-muted mb-4">
            Audit history for activated historical snapshots.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="p-3">Version</th>
                  <th className="p-3">Claims Covered Through</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Updated By</th>
                  <th className="p-3">Updated On</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted">
                      Loading history...
                    </td>
                  </tr>
                ) : historyList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted">
                      No sync history found.
                    </td>
                  </tr>
                ) : (
                  historyList.map((item, index) => {
                    // 格式化时间显示
                    let displayTime = item.createddatetime || 'Initial snapshot'
                    if (item.createddatetime && item.createddatetime !== 'Initial snapshot') {
                      const d = new Date(item.createddatetime)
                      if (!isNaN(d.getTime())) {
                        displayTime = d.toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }
                    }

                    return (
                      <tr key={item.id || index} className="hover:bg-stone-50">
                        <td className="p-3 font-medium">{item.version}</td>
                        <td className="p-3">{item.coverage_date}</td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                              item.status === 'Active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3">{item.method}</td>
                        <td className="p-3">{item.updated_by}</td>
                        <td className="p-3">{displayTime}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
