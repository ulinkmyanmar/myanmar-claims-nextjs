"use client"

import { useEffect, useState } from "react"

export default function DashboardPage() {
  // 定义动态 state，默认设为 0（避免硬编码 33 和 123）
  const [stats, setStats] = useState({
    totalClaims: 0,
    uniqueMembers: 0,
    lastUpdated: "",
    latestVersion: "",
  })
  const [loading, setLoading] = useState(true)

  // 获取真实数据库统计数据
  const loadDashboardStats = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/dashboard/stats", {
        cache: "no-store", // 禁用 Next.js 路由缓存
        headers: { "Cache-Control": "no-cache" },
      })
      if (res.ok) {
        const data = await res.json()
        setStats({
          totalClaims: data.totalClaims,
          uniqueMembers: data.uniqueMembers,
          lastUpdated: data.lastUpdated,
          latestVersion: data.latestVersion,
        })
      }
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardStats()
  }, [])

  return (
    <div>
      {/* 动态渲染卡片数据 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 卡片 1: Total Claims */}
        <div className="p-4 bg-white rounded-xl border">
          <p className="text-sm text-gray-500">Total Claims</p>
          <h3 className="text-2xl font-bold">
            {loading ? "..." : stats.totalClaims.toLocaleString()}
          </h3>
        </div>

        {/* 卡片 2: Unique Members */}
        <div className="p-4 bg-white rounded-xl border">
          <p className="text-sm text-gray-500">Unique Members</p>
          <h3 className="text-2xl font-bold">
            {loading ? "..." : stats.uniqueMembers.toLocaleString()}
          </h3>
        </div>
      </div>
    </div>
  )
}
