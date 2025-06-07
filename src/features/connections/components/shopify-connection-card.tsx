'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-url'
import { 
  Store, 
  Plus, 
  ExternalLink, 
  Settings, 
  Trash2, 
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react'

const shopifyConnectionSchema = z.object({
  shop: z.string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/, 'Invalid Shopify domain format')
    .or(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9\-]*$/, 'Enter store name without .myshopify.com')),
  connectionName: z.string().min(1, 'Connection name is required')
})

interface ShopifyConnection {
  id: string
  connection_name: string
  credentials: {
    shop_domain: string
    access_token: string
    scope: string
  }
  is_active: boolean
  last_connected: string | null
  created_at: string
}

interface ShopifyConnectionCardProps {
  connections: ShopifyConnection[]
  onConnectionAdded: () => void
}

export default function ShopifyConnectionCard({ 
  connections, 
  onConnectionAdded 
}: ShopifyConnectionCardProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const form = useForm<z.infer<typeof shopifyConnectionSchema>>({
    resolver: zodResolver(shopifyConnectionSchema),
    defaultValues: {
      shop: '',
      connectionName: ''
    }
  })

  async function onSubmit(values: z.infer<typeof shopifyConnectionSchema>) {
    try {
      setIsConnecting(true)
      
      // Normalize shop domain
      let shopDomain = values.shop
      if (!shopDomain.includes('.myshopify.com')) {
        shopDomain = `${shopDomain}.myshopify.com`
      }

      // Initiate OAuth flow
      const response = await apiRequest('/api/auth/shopify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop: shopDomain,
          connectionName: values.connectionName
        })
      })

      if (!response.ok) {
        throw new Error('Failed to initiate connection')
      }

      const data = await response.json()
      
      if (data.success) {
        // Store state for OAuth callback validation
        localStorage.setItem('shopify_oauth_state', data.data.state)
        localStorage.setItem('shopify_connection_name', data.data.connectionName)
        
        // Redirect to Shopify OAuth
        window.location.href = data.data.authUrl
      } else {
        throw new Error(data.error || 'Failed to initiate connection')
      }
    } catch (error) {
      console.error('Connection error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to connect to Shopify')
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this Shopify store?')) {
      return
    }

    try {
      const response = await apiRequest(`/api/platform-connections/${connectionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Shopify store disconnected')
        onConnectionAdded() // Refresh the connections list
      } else {
        throw new Error('Failed to disconnect store')
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      toast.error('Failed to disconnect store')
    }
  }

  const handleTest = async (connectionId: string) => {
    try {
      const response = await apiRequest(`/api/platform-connections/${connectionId}/test`)
      const data = await response.json()
      
      if (data.success) {
        toast.success('Connection test successful')
      } else {
        toast.error('Connection test failed')
      }
    } catch (error) {
      toast.error('Failed to test connection')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            <CardTitle>Shopify Stores</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Connect Store
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Shopify Store</DialogTitle>
                <DialogDescription>
                  Enter your Shopify store details to establish a connection for product synchronization.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="connectionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Connection Name</FormLabel>
                        <FormControl>
                          <Input placeholder="My Store" {...field} />
                        </FormControl>
                        <FormDescription>
                          A friendly name to identify this connection
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="shop"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shopify Store Domain</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <Input 
                              placeholder="your-store-name" 
                              {...field}
                              className="rounded-r-none"
                            />
                            <div className="flex items-center bg-muted px-3 text-sm text-muted-foreground border border-l-0 rounded-r-md">
                              .myshopify.com
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Enter your store name without .myshopify.com
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button type="submit" disabled={isConnecting}>
                      {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Connect Store
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setDialogOpen(false)}
                      disabled={isConnecting}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Connect your Shopify stores to sync products automatically
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connections.length === 0 ? (
          <div className="text-center py-8">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Shopify stores connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect your first Shopify store to start syncing products
            </p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Your First Store
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map((connection) => (
              <div 
                key={connection.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{connection.connection_name}</h4>
                      {connection.is_active ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {connection.credentials.shop_domain}
                    </p>
                    {connection.last_connected && (
                      <p className="text-xs text-muted-foreground">
                        Last connected: {new Date(connection.last_connected).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://${connection.credentials.shop_domain}/admin`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(connection.id)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(connection.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}