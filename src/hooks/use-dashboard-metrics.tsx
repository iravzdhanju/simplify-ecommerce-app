'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api-url'

interface DashboardMetrics {
  products: {
    total: number
    active: number
    trend: string
  }
  connections: {
    total: number
    active: number
    trend: string
  }
  sync: {
    recentSyncs: number
    recentErrors: number
    successRate: number
    successRateTrend: number
  }
  overview: {
    totalSyncAttempts: number
    successfulSyncs: number
    errorRate: number
  }
}

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiRequest('/api/dashboard/metrics')
      const data = await response.json()
      
      if (data.success) {
        setMetrics(data.data)
      } else {
        setError(data.error || 'Failed to fetch metrics')
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err)
      setError('Failed to fetch dashboard metrics')
    } finally {
      setLoading(false)
    }
  }

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics
  }
}