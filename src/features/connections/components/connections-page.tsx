'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ShopifyConnectionCard from './shopify-connection-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useImportNotificationStore } from '@/stores/import-notification-store';
import { apiRequest } from '@/lib/api-url';

import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Zap
} from 'lucide-react';

interface Connection {
  id: string;
  platform: string;
  connection_name: string;
  is_active: boolean;
  last_connected: string | null;
  created_at: string;
  credentials: any;
}

interface ConnectionStats {
  total: number;
  active: number;
  inactive: number;
  lastSync: string | null;
}

export default function ConnectionsPage() {
  const searchParams = useSearchParams();
  const { startImport, refreshConnections, forceReset } =
    useImportNotificationStore();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [disconnectedConnectionIds, setDisconnectedConnectionIds] = useState<
    Set<string>
  >(new Set());
  const [stats, setStats] = useState<ConnectionStats>({
    total: 0,
    active: 0,
    inactive: 0,
    lastSync: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConnections();
    // Also refresh the store connections
    refreshConnections();
  }, [refreshConnections]);

  // Check for auto-import trigger
  useEffect(() => {
    const success = searchParams.get('success');
    const shop = searchParams.get('shop');
    const autoImport = searchParams.get('auto_import');

    if (success === 'shopify_connected' && shop && autoImport === 'started') {
      // Extract shop name from domain
      const shopName = shop.replace('.myshopify.com', '');

      // First refresh connections to ensure store has latest state
      const triggerImport = async () => {
        await refreshConnections();

        // Small delay to ensure state is updated
        setTimeout(() => {
          // Start import notification
          startImport('shopify', shopName);
        }, 500);
      };

      triggerImport();

      // Clean up URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('shop');
      url.searchParams.delete('auto_import');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, startImport, refreshConnections]);

  const fetchConnections = async () => {
    try {
      const response = await apiRequest('/api/platform-connections');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Filter out disconnected connections
          const activeConnections = data.data.filter(
            (conn: Connection) => !disconnectedConnectionIds.has(conn.id)
          );
          setConnections(activeConnections);
          updateStats(activeConnections);
        }
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionDisconnected = (connectionId: string) => {
    // Add to disconnected list
    setDisconnectedConnectionIds((prev) => new Set(prev).add(connectionId));
    // Remove from current connections
    setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
    // Update stats
    const updatedConnections = connections.filter(
      (conn) => conn.id !== connectionId
    );
    updateStats(updatedConnections);

    // Refresh store connections as well
    refreshConnections();

    // Force stop all polling since connection is deleted
    forceReset();
  };

  const updateStats = (connections: Connection[]) => {
    const active = connections.filter((c) => c.is_active).length;
    const inactive = connections.length - active;
    const lastSync =
      connections
        .filter((c) => c.last_connected)
        .sort(
          (a, b) =>
            new Date(b.last_connected!).getTime() -
            new Date(a.last_connected!).getTime()
        )
        .map((c) => c.last_connected)[0] || null;

    setStats({
      total: connections.length,
      active,
      inactive,
      lastSync
    });
  };

  const shopifyConnections = connections.filter(
    (c) => c.platform === 'shopify'
  );

  if (loading) {
    return <div>Loading connections...</div>;
  }

  return (
    <div className='space-y-6'>
      {/* Connection Stats */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Connections
            </CardTitle>
            <Activity className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.total}</div>
            <p className='text-muted-foreground text-xs'>
              Platform integrations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active</CardTitle>
            <CheckCircle2 className='h-4 w-4 text-green-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              {stats.active}
            </div>
            <p className='text-muted-foreground text-xs'>Connected & working</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Inactive</CardTitle>
            <AlertCircle className='h-4 w-4 text-orange-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-orange-600'>
              {stats.inactive}
            </div>
            <p className='text-muted-foreground text-xs'>Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Last Sync</CardTitle>
            <Clock className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats.lastSync
                ? new Date(stats.lastSync).toLocaleDateString()
                : 'Never'}
            </div>
            <p className='text-muted-foreground text-xs'>
              Most recent activity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Connections */}
      <Tabs defaultValue='shopify' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='shopify' className='flex items-center gap-2'>
            <Zap className='h-4 w-4' />
            Shopify
            {shopifyConnections.length > 0 && (
              <Badge variant='secondary' className='ml-1'>
                {shopifyConnections.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value='amazon' disabled>
            <TrendingUp className='mr-2 h-4 w-4' />
            Amazon
            <Badge variant='outline' className='ml-1'>
              Soon
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='shopify'>
          <div className='space-y-8'>
            <ShopifyConnectionCard
              connections={shopifyConnections}
              onConnectionAdded={fetchConnections}
              onConnectionDisconnected={handleConnectionDisconnected}
            />
          </div>
        </TabsContent>

        <TabsContent value='amazon'>
          <Card>
            <CardHeader>
              <CardTitle>Amazon Integration</CardTitle>
              <CardDescription>
                Amazon SP-API integration coming soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='py-8 text-center'>
                <TrendingUp className='text-muted-foreground mx-auto mb-4 h-12 w-12' />
                <h3 className='mb-2 text-lg font-semibold'>
                  Amazon Integration Coming Soon
                </h3>
                <p className='text-muted-foreground'>
                  We're working on Amazon SP-API integration to sync your
                  products with Amazon marketplaces.
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
            <div className='space-y-3'>
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className='flex items-center justify-between rounded-lg border p-3'
                >
                  <div className='flex items-center gap-3'>
                    <div
                      className={`h-3 w-3 rounded-full ${
                        connection.is_active ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <div className='font-medium'>
                        {connection.connection_name}
                      </div>
                      <div className='text-muted-foreground text-sm capitalize'>
                        {connection.platform}
                      </div>
                    </div>
                  </div>
                  <div className='text-right'>
                    <div className='text-sm'>
                      {connection.is_active ? (
                        <Badge variant='default' className='bg-green-500'>
                          Active
                        </Badge>
                      ) : (
                        <Badge variant='destructive'>Inactive</Badge>
                      )}
                    </div>
                    {connection.last_connected && (
                      <div className='text-muted-foreground mt-1 text-xs'>
                        Last:{' '}
                        {new Date(
                          connection.last_connected
                        ).toLocaleDateString()}
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
  );
}
