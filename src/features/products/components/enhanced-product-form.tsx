'use client'

import { FileUploader } from '@/components/file-uploader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Product } from '@/lib/api/products'
import { productsApi } from '@/lib/api/products'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { toast } from 'sonner'
import * as z from 'zod'
import { Loader2, ExternalLink, Sync, Check, X } from 'lucide-react'

const MAX_FILE_SIZE = 5000000
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp'
]

const formSchema = z.object({
  images: z
    .array(z.any())
    .min(1, 'At least one image is required')
    .max(10, 'Maximum 10 images allowed'),
  name: z.string().min(2, {
    message: 'Product name must be at least 2 characters.'
  }),
  category: z.string().min(1, 'Category is required'),
  price: z.number().min(0, 'Price must be positive'),
  description: z.string().min(10, {
    message: 'Description must be at least 10 characters.'
  }),
  // Enhanced Shopify fields
  sku: z.string().optional(),
  brand: z.string().optional(),
  inventory: z.number().min(0, 'Inventory must be non-negative').default(0),
  status: z.enum(['draft', 'active', 'inactive']).default('draft'),
  tags: z.array(z.string()).default([]),
  // Shopify sync options
  autoSyncToShopify: z.boolean().default(false),
  syncInventory: z.boolean().default(true),
  syncPrices: z.boolean().default(true),
})

interface EnhancedProductFormProps {
  initialData?: Product | null
  pageTitle: string
  onSuccess?: (product: Product) => void
}

export default function EnhancedProductForm({
  initialData,
  pageTitle,
  onSuccess
}: EnhancedProductFormProps) {
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [tagsInput, setTagsInput] = useState('')

  const isEdit = !!initialData?.id

  const defaultValues = {
    name: initialData?.name || '',
    category: initialData?.category || '',
    price: initialData?.price || 0,
    description: initialData?.description || '',
    sku: initialData?.sku || '',
    brand: initialData?.brand || '',
    inventory: initialData?.inventory || 0,
    status: initialData?.status || 'draft',
    tags: initialData?.tags || [],
    autoSyncToShopify: false,
    syncInventory: true,
    syncPrices: true,
    images: [] // Would be populated from initialData.images
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setLoading(true)
      
      const productData: Partial<Product> = {
        name: values.name,
        description: values.description,
        price: values.price,
        category: values.category,
        sku: values.sku,
        brand: values.brand,
        inventory: values.inventory,
        status: values.status,
        tags: values.tags,
        images: [], // Would handle image upload
      }

      let result
      if (isEdit && initialData) {
        result = await productsApi.updateProduct(initialData.id, productData)
      } else {
        result = await productsApi.createProduct(productData)
      }

      if (result.success) {
        toast.success(`Product ${isEdit ? 'updated' : 'created'} successfully`)
        
        // Auto-sync to Shopify if enabled
        if (values.autoSyncToShopify) {
          await handleShopifySync(result.product.id)
        }
        
        onSuccess?.(result.product)
      } else {
        toast.error('Failed to save product')
      }
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error('An error occurred while saving the product')
    } finally {
      setLoading(false)
    }
  }

  async function handleShopifySync(productId: string) {
    try {
      setSyncing(true)
      const operation = isEdit ? 'update' : 'create'
      const result = await productsApi.syncToShopify(productId, operation)
      
      if (result.success) {
        toast.success('Product synced to Shopify successfully')
      } else {
        toast.error(`Shopify sync failed: ${result.message}`)
      }
    } catch (error) {
      console.error('Error syncing to Shopify:', error)
      toast.error('Failed to sync to Shopify')
    } finally {
      setSyncing(false)
    }
  }

  function addTag() {
    if (tagsInput.trim() && !form.getValues('tags').includes(tagsInput.trim())) {
      const currentTags = form.getValues('tags')
      form.setValue('tags', [...currentTags, tagsInput.trim()])
      setTagsInput('')
    }
  }

  function removeTag(tagToRemove: string) {
    const currentTags = form.getValues('tags')
    form.setValue('tags', currentTags.filter(tag => tag !== tagToRemove))
  }

  const syncStatus = initialData?.sync_status?.shopify

  return (
    <div className="space-y-6">
      <Card className="mx-auto w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-left text-2xl font-bold">
              {pageTitle}
            </CardTitle>
            {initialData?.sync_status && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Shopify:</span>
                {syncStatus === 'success' && (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="w-3 h-3 mr-1" />
                    Synced
                  </Badge>
                )}
                {syncStatus === 'error' && (
                  <Badge variant="destructive">
                    <X className="w-3 h-3 mr-1" />
                    Error
                  </Badge>
                )}
                {syncStatus === 'pending' && (
                  <Badge variant="secondary">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Pending
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Images Section */}
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <div className="space-y-6">
                    <FormItem className="w-full">
                      <FormLabel>Product Images</FormLabel>
                      <FormControl>
                        <FileUploader
                          value={field.value}
                          onValueChange={field.onChange}
                          maxFiles={10}
                          maxSize={4 * 1024 * 1024}
                          disabled={loading}
                        />
                      </FormControl>
                      <FormDescription>
                        Upload up to 10 images. First image will be the main product image.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  </div>
                )}
              />

              {/* Basic Information */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter product name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="Product SKU" {...field} />
                      </FormControl>
                      <FormDescription>
                        Stock Keeping Unit for inventory tracking
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="electronics">Electronics</SelectItem>
                          <SelectItem value="clothing">Clothing</SelectItem>
                          <SelectItem value="furniture">Furniture</SelectItem>
                          <SelectItem value="toys">Toys</SelectItem>
                          <SelectItem value="books">Books</SelectItem>
                          <SelectItem value="beauty">Beauty Products</SelectItem>
                          <SelectItem value="jewelry">Jewelry</SelectItem>
                          <SelectItem value="groceries">Groceries</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input placeholder="Product brand" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inventory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inventory</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Current stock quantity
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter product description"
                        className="min-h-32"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tags */}
              <div className="space-y-4">
                <FormLabel>Tags</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.watch('tags').map((tag) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer">
                      {tag}
                      <X
                        className="w-3 h-3 ml-1"
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Shopify Sync Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Shopify Sync Settings</h3>
                
                <FormField
                  control={form.control}
                  name="autoSyncToShopify"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Auto-sync to Shopify
                        </FormLabel>
                        <FormDescription>
                          Automatically sync this product to connected Shopify stores after saving
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="syncInventory"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Sync Inventory
                        </FormLabel>
                        <FormDescription>
                          Keep inventory levels synchronized with Shopify
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="syncPrices"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Sync Prices
                        </FormLabel>
                        <FormDescription>
                          Keep prices synchronized with Shopify
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEdit ? 'Update Product' : 'Create Product'}
                </Button>
                
                {isEdit && initialData && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleShopifySync(initialData.id)}
                    disabled={syncing}
                  >
                    {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Sync className="mr-2 h-4 w-4" />
                    Sync to Shopify
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Sync Status Card */}
      {initialData?.sync_status && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Shopify</span>
                <div className="flex items-center gap-2">
                  {syncStatus === 'success' && (
                    <>
                      <Badge variant="default" className="bg-green-500">
                        <Check className="w-3 h-3 mr-1" />
                        Synced
                      </Badge>
                      {initialData.sync_status.last_synced && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(initialData.sync_status.last_synced).toLocaleDateString()}
                        </span>
                      )}
                    </>
                  )}
                  {syncStatus === 'error' && (
                    <div className="space-y-1">
                      <Badge variant="destructive">
                        <X className="w-3 h-3 mr-1" />
                        Error
                      </Badge>
                      {initialData.sync_status.error_message && (
                        <p className="text-xs text-red-600">
                          {initialData.sync_status.error_message}
                        </p>
                      )}
                    </div>
                  )}
                  {syncStatus === 'pending' && (
                    <Badge variant="secondary">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Pending
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}