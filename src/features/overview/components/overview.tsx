import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardAction
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaGraph } from './area-graph';
import { BarGraph } from './bar-graph';
import { PieGraph } from './pie-graph';
import { RecentSales } from './recent-sales';
import { IconTrendingUp, IconTrendingDown, IconRefresh } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics';
import { Skeleton } from '@/components/ui/skeleton';

export default function OverViewPage() {
  const { metrics, loading, error, refetch } = useDashboardMetrics()

  const formatTrend = (value: number) => {
    const isPositive = value >= 0
    return {
      icon: isPositive ? IconTrendingUp : IconTrendingDown,
      text: `${isPositive ? '+' : ''}${value}%`,
      variant: isPositive ? 'default' : 'destructive' as const
    }
  }

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <div className='flex items-center justify-between space-y-2'>
          <h2 className='text-2xl font-bold tracking-tight'>
            Hi, Welcome back 👋
          </h2>
          <div className='hidden items-center space-x-2 md:flex'>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refetch}
              disabled={loading}
            >
              <IconRefresh className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button>Download</Button>
          </div>
        </div>
        <Tabs defaultValue='overview' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='analytics' disabled>
              Analytics
            </TabsTrigger>
          </TabsList>
          <TabsContent value='overview' className='space-y-4'>
            <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4'>
              
              {/* Total Products */}
              <Card className='@container/card'>
                <CardHeader>
                  <CardDescription>Total Products</CardDescription>
                  <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                    {loading ? <Skeleton className="h-8 w-16" /> : metrics?.products.total || 0}
                  </CardTitle>
                  {!loading && metrics && (
                    <CardAction>
                      <Badge variant='outline'>
                        <IconTrendingUp />
                        {metrics.products.trend}
                      </Badge>
                    </CardAction>
                  )}
                </CardHeader>
                <CardFooter className='flex-col items-start gap-1.5 text-sm'>
                  <div className='line-clamp-1 flex gap-2 font-medium'>
                    {loading ? <Skeleton className="h-4 w-24" /> : 
                      `${metrics?.products.active || 0} active products`
                    }
                  </div>
                  <div className='text-muted-foreground'>
                    Products in your catalog
                  </div>
                </CardFooter>
              </Card>

              {/* Platform Connections */}
              <Card className='@container/card'>
                <CardHeader>
                  <CardDescription>Platform Connections</CardDescription>
                  <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                    {loading ? <Skeleton className="h-8 w-8" /> : metrics?.connections.total || 0}
                  </CardTitle>
                  {!loading && metrics && (
                    <CardAction>
                      <Badge variant='outline'>
                        <IconTrendingUp />
                        {metrics.connections.trend}
                      </Badge>
                    </CardAction>
                  )}
                </CardHeader>
                <CardFooter className='flex-col items-start gap-1.5 text-sm'>
                  <div className='line-clamp-1 flex gap-2 font-medium'>
                    {loading ? <Skeleton className="h-4 w-24" /> :
                      `${metrics?.connections.active || 0} active connections`
                    }
                  </div>
                  <div className='text-muted-foreground'>
                    Shopify, Amazon integrations
                  </div>
                </CardFooter>
              </Card>

              {/* Sync Success Rate */}
              <Card className='@container/card'>
                <CardHeader>
                  <CardDescription>Sync Success Rate</CardDescription>
                  <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                    {loading ? <Skeleton className="h-8 w-16" /> : 
                      `${metrics?.sync.successRate || 0}%`
                    }
                  </CardTitle>
                  {!loading && metrics && (
                    <CardAction>
                      <Badge variant={metrics.sync.successRateTrend >= 0 ? 'outline' : 'destructive'}>
                        {metrics.sync.successRateTrend >= 0 ? <IconTrendingUp /> : <IconTrendingDown />}
                        {metrics.sync.successRateTrend >= 0 ? '+' : ''}{metrics.sync.successRateTrend}%
                      </Badge>
                    </CardAction>
                  )}
                </CardHeader>
                <CardFooter className='flex-col items-start gap-1.5 text-sm'>
                  <div className='line-clamp-1 flex gap-2 font-medium'>
                    {loading ? <Skeleton className="h-4 w-24" /> :
                      `${metrics?.sync.recentSyncs || 0} recent syncs`
                    }
                  </div>
                  <div className='text-muted-foreground'>
                    Last 24 hours performance
                  </div>
                </CardFooter>
              </Card>

              {/* Sync Errors */}
              <Card className='@container/card'>
                <CardHeader>
                  <CardDescription>Recent Errors</CardDescription>
                  <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                    {loading ? <Skeleton className="h-8 w-8" /> : metrics?.sync.recentErrors || 0}
                  </CardTitle>
                  {!loading && metrics && (
                    <CardAction>
                      <Badge variant={metrics.sync.recentErrors === 0 ? 'outline' : 'destructive'}>
                        {metrics.sync.recentErrors === 0 ? <IconTrendingUp /> : <IconTrendingDown />}
                        {metrics.overview.errorRate}%
                      </Badge>
                    </CardAction>
                  )}
                </CardHeader>
                <CardFooter className='flex-col items-start gap-1.5 text-sm'>
                  <div className='line-clamp-1 flex gap-2 font-medium'>
                    {loading ? <Skeleton className="h-4 w-24" /> :
                      metrics?.sync.recentErrors === 0 ? 'All systems healthy' : 'Needs attention'
                    }
                  </div>
                  <div className='text-muted-foreground'>
                    Sync error monitoring
                  </div>
                </CardFooter>
              </Card>
            </div>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
              <div className='col-span-4'>
                <BarGraph />
              </div>
              <Card className='col-span-4 md:col-span-3'>
                <RecentSales />
              </Card>
              <div className='col-span-4'>
                <AreaGraph />
              </div>
              <div className='col-span-4 md:col-span-3'>
                <PieGraph />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
