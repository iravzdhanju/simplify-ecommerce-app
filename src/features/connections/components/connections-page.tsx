'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ShopifyConnectionCard from './shopify-connection-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiRequest } from '@/lib/api-url'
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  TrendingUp,
  Zap
} from 'lucide-react'

interface Connection {
  id: string
  platform: string
  connection_name: string
  is_active: boolean
  last_connected: string | null
  created_at: string
  credentials: any
}

interface ConnectionStats {
  total: number
  active: number
  inactive: number
  lastSync: string | null
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [stats, setStats] = useState<ConnectionStats>({
    total: 0,
    active: 0,
    inactive: 0,
    lastSync: null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      const response = await apiRequest('/api/platform-connections')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setConnections(data.data)
          updateStats(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStats = (connections: Connection[]) => {
    const active = connections.filter(c => c.is_active).length
    const inactive = connections.length - active
    const lastSync = connections
      .filter(c => c.last_connected)
      .sort((a, b) => new Date(b.last_connected!).getTime() - new Date(a.last_connected!).getTime())
      .map(c => c.last_connected)[0] || null

    setStats({
      total: connections.length,
      active,
      inactive,
      lastSync
    })
  }

  const shopifyConnections = connections.filter(c => c.platform === 'shopify')

  if (loading) {
    return <div>Loading connections...</div>
  }

  return (
    <div className="space-y-6">
      {/* Connection Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Platform integrations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Connected & working
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.lastSync 
                ? new Date(stats.lastSync).toLocaleDateString()
                : 'Never'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Most recent activity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Connections */}
      <Tabs defaultValue="shopify" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shopify" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Shopify
            {shopifyConnections.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {shopifyConnections.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="amazon" disabled>
            <TrendingUp className="h-4 w-4 mr-2" />
            Amazon
            <Badge variant="outline" className="ml-1">
              Soon
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shopify">
          <ShopifyConnectionCard 
            connections={shopifyConnections}
            onConnectionAdded={fetchConnections}
          />
        </TabsContent>

        <TabsContent value="amazon">
          <Card>
            <CardHeader>
              <CardTitle>Amazon Integration</CardTitle>
              <CardDescription>
                Amazon SP-API integration coming soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Amazon Integration Coming Soon</h3>
                <p className="text-muted-foreground">
                  We're working on Amazon SP-API integration to sync your products with Amazon marketplaces.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connection Health Status */}
      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Health</CardTitle>
            <CardDescription>
              Overview of all platform connection statuses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {connections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      connection.is_active ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <div className="font-medium">
                        {connection.connection_name}
                      </div>
                      <div className="text-sm text-muted-foreground capitalize">
                        {connection.platform}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      {connection.is_active ? (
                        <Badge variant="default" className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </div>
                    {connection.last_connected && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Last: {new Date(connection.last_connected).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}