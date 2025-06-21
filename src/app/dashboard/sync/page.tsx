'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  RefreshCw, 
  Download, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Activity,
  Database,
  Store,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface SyncStats {
  totalProducts: number
  syncedProducts: number
  pendingProducts: number
  errorProducts: number
  lastSyncTime: string | null
}

interface SyncHealth {
  status: 'healthy' | 'warning' | 'error'
  message: string
  details: any
}

interface SyncActivity {
  id: string
  product_id: string
  platform: string
  operation: string
  status: string
  message: string | null
  execution_time: number | null
  created_at: string
  products?: {
    id: string
    title: string
  }
}

export default function SyncPage() {
  const [stats, setStats] = useState<SyncStats | null>(null)
  const [health, setHealth] = useState<SyncHealth | null>(null)
  const [activities, setActivities] = useState<SyncActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSyncStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sync/status')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()

      if (data.success) {
        setStats(data.data.stats)
        setHealth(data.data.health)
        setActivities(data.data.recentActivity)
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch sync status')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error occurred'
      setError(errorMessage)
      console.error('Sync status fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const performBulkImport = async (type: 'full' | 'incremental') => {
    try {
      setSyncing(true)
      const response = await fetch('/api/sync/shopify/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: type })
      })

      const data = await response.json()
      if (data.success) {
        await fetchSyncStatus() // Refresh data
      } else {
        setError(data.error || 'Sync operation failed')
      }
    } catch (err) {
      setError('Failed to perform sync')
      console.error('Bulk sync error:', err)
    } finally {
      setSyncing(false)
    }
  }

  const syncPendingProducts = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/sync/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'shopify' })
      })

      const data = await response.json()
      if (data.success) {
        await fetchSyncStatus() // Refresh data
      } else {
        setError(data.error || 'Failed to sync pending products')
      }
    } catch (err) {
      setError('Failed to sync pending products')
      console.error('Pending sync error:', err)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchSyncStatus()
    // Refresh every 30 seconds
    const interval = setInterval(fetchSyncStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'create':
        return <Database className="h-4 w-4" />
      case 'update':
        return <RefreshCw className="h-4 w-4" />
      case 'delete':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage product synchronization across platforms
          </p>
        </div>
        <Button onClick={fetchSyncStatus} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Health Status */}
      {health && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getHealthIcon(health.status)}
                <div>
                  <h3 className="font-semibold">Sync Health</h3>
                  <p className="text-sm text-muted-foreground">{health.message}</p>
                </div>
              </div>
              {health.details?.hasConnections === false && (
                <Button asChild variant="outline">
                  <a href="/dashboard/connections">
                    Connect Store
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                In your catalog
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Synced Products</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.syncedProducts}</div>
              <p className="text-xs text-muted-foreground">
                Successfully synced
              </p>
              {stats.totalProducts > 0 && (
                <Progress 
                  value={(stats.syncedProducts / stats.totalProducts) * 100} 
                  className="mt-2"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Sync</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingProducts}</div>
              <p className="text-xs text-muted-foreground">
                Waiting to sync
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sync Errors</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.errorProducts}</div>
              <p className="text-xs text-muted-foreground">
                Need attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 flex-wrap">
        {health?.details?.hasConnections === false ? (
          <div className="w-full">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Connect your Shopify store to start syncing products.{' '}
                <a href="/dashboard/connections" className="font-medium underline">
                  Go to Connections
                </a>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            <Button 
              onClick={() => performBulkImport('full')} 
              disabled={syncing}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Full Import from Shopify
            </Button>
            
            <Button 
              onClick={() => performBulkImport('incremental')} 
              disabled={syncing}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Incremental Import
            </Button>
            
            <Button 
              onClick={syncPendingProducts} 
              disabled={syncing || (stats?.pendingProducts || 0) === 0}
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              Sync Pending to Shopify
            </Button>
          </>
        )}
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="logs">Detailed Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sync Activity</CardTitle>
              <CardDescription>
                Latest synchronization operations and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity found
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0">
                        {getOperationIcon(activity.operation)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium">
                            {activity.products?.title || `Product ${activity.product_id.slice(0, 8)}...`}
                          </p>
                          {getStatusBadge(activity.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {activity.operation} • {activity.platform} • 
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </p>
                        {activity.message && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {activity.message}
                          </p>
                        )}
                      </div>
                      {activity.execution_time && (
                        <div className="text-xs text-muted-foreground">
                          {activity.execution_time}ms
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Sync Logs</CardTitle>
              <CardDescription>
                Complete history of all sync operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium">
                          {activity.products?.title || activity.product_id.slice(0, 8) + '...'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{activity.platform}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {getOperationIcon(activity.operation)}
                            <span className="capitalize">{activity.operation}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(activity.status)}</TableCell>
                        <TableCell className="text-xs">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-xs">
                          {activity.execution_time ? `${activity.execution_time}ms` : '-'}
                        </TableCell>
                        <TableCell>
                          {activity.message && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Sync Details</DialogTitle>
                                  <DialogDescription>
                                    Details for {activity.operation} operation on {activity.platform}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-medium">Message</h4>
                                    <p className="text-sm text-muted-foreground">{activity.message}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium">Product ID</h4>
                                    <p className="text-sm font-mono">{activity.product_id}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium">Timestamp</h4>
                                    <p className="text-sm">{new Date(activity.created_at).toLocaleString()}</p>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}