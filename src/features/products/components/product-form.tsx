'use client';

import { FileUploader } from '@/components/file-uploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertModal } from '@/components/modal/alert-modal';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Product } from '@/constants/mock-api';
import { ShopifyProduct } from '@/types/index';
import { productsApi, Product as APIProduct } from '@/lib/api/products';
import { apiRequest } from '@/lib/api-url';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, X, Upload, ArrowLeft, HelpCircle } from 'lucide-react';
import * as z from 'zod';

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

// Schema for product variants
const variantSchema = z.object({
  title: z.string().min(1, 'Variant title is required'),
  price: z.number().min(0, 'Price must be positive'),
  weight: z.number().min(0, 'Weight must be positive'),
  compare_at_price: z.number().optional(),
  inventory_management: z.string().optional(),
  available: z.boolean().default(true),
  sku: z.string().optional(),
  requires_shipping: z.boolean().default(true),
  taxable: z.boolean().default(true),
  barcode: z.string().optional(),
  option1: z.string().optional(),
  option2: z.string().optional(),
  option3: z.string().optional()
});

// Schema for product options
const optionSchema = z.object({
  name: z.string().min(1, 'Option name is required'),
  position: z.number().min(1)
});

const formSchema = z.object({
  images: z
    .any()
    .refine(
      (files) => !files || files?.length <= 10,
      'Maximum 10 images allowed.'
    )
    .refine(
      (files) =>
        !files || files.every((file: File) => file?.size <= MAX_FILE_SIZE),
      `Max file size is 5MB per image.`
    )
    .refine(
      (files) =>
        !files ||
        files.every((file: File) => ACCEPTED_IMAGE_TYPES.includes(file?.type)),
      '.jpg, .jpeg, .png and .webp files are accepted.'
    )
    .optional(),
  title: z.string().min(2, {
    message: 'Product title must be at least 2 characters.'
  }),
  handle: z
    .string()
    .min(2, {
      message: 'Product handle must be at least 2 characters.'
    })
    .regex(/^[a-z0-9-]+$/, {
      message:
        'Handle can only contain lowercase letters, numbers, and hyphens.'
    }),
  description: z.string().min(10, {
    message: 'Description must be at least 10 characters.'
  }),
  vendor: z.string().min(1, 'Vendor is required'),
  type: z.string().min(1, 'Product type is required'),
  tags: z.array(z.string()).default([]),
  published_at: z.string().optional(),
  price: z.number().min(0, 'Price must be positive'),
  compare_at_price: z.number().optional(),
  cost_per_item: z.number().optional(),
  available: z.boolean().default(true),
  track_quantity: z.boolean().default(true),
  quantity: z.number().min(0).default(0),
  continue_selling: z.boolean().default(false),
  requires_shipping: z.boolean().default(true),
  weight: z.number().min(0).default(0),
  charge_tax: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, 'At least one variant is required'),
  options: z.array(optionSchema).max(3, 'Maximum 3 options allowed'),
  marketplace: z.array(z.enum(['Shopify', 'Amazon'])).min(1, {
    message: 'Please select at least one marketplace.'
  }),
  collections: z.array(z.string()).default([]),
  status: z.enum(['active', 'draft', 'archived']).default('active')
});

export default function ProductForm({
  initialData,
  pageTitle
}: {
  initialData: Product | null;
  pageTitle: string;
}) {
  const isEditing = !!initialData;
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<z.infer<
    typeof formSchema
  > | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [collectionInput, setCollectionInput] = useState('');
  const [hasShopifyConnection, setHasShopifyConnection] = useState<
    boolean | null
  >(null);

  const defaultValues = {
    title: initialData?.name || '',
    handle:
      initialData?.name
        ?.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') || '',
    description: initialData?.description || '',
    vendor: '',
    type: initialData?.category || '',
    tags: [],
    published_at: new Date().toISOString().split('T')[0],
    price: initialData?.price || 0,
    compare_at_price: undefined,
    cost_per_item: undefined,
    available: true,
    track_quantity: true,
    quantity: 0,
    continue_selling: false,
    requires_shipping: true,
    weight: 0,
    charge_tax: true,
    variants: [
      {
        title: 'Default Title',
        price: initialData?.price || 0,
        weight: 0,
        available: true,
        requires_shipping: true,
        taxable: true
      }
    ],
    options: [],
    marketplace: ['Shopify'] as ('Shopify' | 'Amazon')[],
    collections: [],
    status: 'active' as const
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues
  });

  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant
  } = useFieldArray({
    control: form.control,
    name: 'variants'
  });

  const {
    fields: optionFields,
    append: appendOption,
    remove: removeOption
  } = useFieldArray({
    control: form.control,
    name: 'options'
  });

  // Auto-generate handle from title
  const watchTitle = form.watch('title');
  const watchPrice = form.watch('price');
  const watchComparePrice = form.watch('compare_at_price');
  const watchCostPerItem = form.watch('cost_per_item');

  useEffect(() => {
    if (watchTitle && !isEditing) {
      const handle = watchTitle
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      form.setValue('handle', handle);
    }
  }, [watchTitle, form, isEditing]);

  // Check for Shopify connections on component mount
  useEffect(() => {
    const checkShopifyConnections = async () => {
      try {
        const response = await apiRequest('/api/platform-connections');
        if (response.ok) {
          const data = await response.json();
          const shopifyConnections =
            data.data?.filter(
              (conn: any) => conn.platform === 'shopify' && conn.is_active
            ) || [];
          setHasShopifyConnection(shopifyConnections.length > 0);
        } else {
          setHasShopifyConnection(false);
        }
      } catch (error) {
        console.error('Error checking Shopify connections:', error);
        setHasShopifyConnection(false);
      }
    };

    checkShopifyConnections();
  }, []);

  // Calculate profit and margin
  const calculateProfit = () => {
    if (watchPrice && watchCostPerItem) {
      return watchPrice - watchCostPerItem;
    }
    return 0;
  };

  const calculateMargin = () => {
    if (watchPrice && watchCostPerItem && watchPrice > 0) {
      return (((watchPrice - watchCostPerItem) / watchPrice) * 100).toFixed(1);
    }
    return '0';
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (isEditing) {
      setPendingFormData(values);
      setShowConfirmModal(true);
    } else {
      handleFormSubmission(values);
    }
  }

  const handleFormSubmission = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      // Transform form data to match Product API format
      const productData: Partial<APIProduct> = {
        name: values.title, // Map title to name for our API
        description: values.description,
        price: values.price,
        category: values.type, // Map type to category
        brand: values.vendor, // Map vendor to brand
        sku: values.handle, // Using handle as SKU for now
        inventory: values.quantity,
        status: values.status,
        tags: values.tags,
        images: [], // Would handle image upload from values.images
        marketplace: values.marketplace
      };

      let result;
      if (isEditing) {
        result = await productsApi.updateProduct(initialData!.id, productData);
      } else {
        result = await productsApi.createProduct(productData);
      }

      if (result.success) {
        toast.success(
          `Product ${isEditing ? 'updated' : 'created'} successfully`
        );

        // Auto-sync to Shopify if marketplace includes Shopify
        if (values.marketplace.includes('Shopify')) {
          await handleShopifySync(result.product.id);
        }
      } else {
        toast.error('Failed to save product');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to save product. Please try again.');
    } finally {
      setIsLoading(false);
      setShowConfirmModal(false);
      setPendingFormData(null);
    }
  };

  const handleShopifySync = async (productId: string) => {
    try {
      const operation = isEditing ? 'update' : 'create';
      console.log(
        `Attempting to sync product ${productId} to Shopify with operation: ${operation}`
      );

      const result = await productsApi.syncToShopify(productId, operation);

      console.log('Shopify sync result:', result);

      if (result.success) {
        toast.success('Product synced to Shopify successfully');
      } else {
        console.error('Shopify sync failed:', result.message);
        toast.error(`Shopify sync failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error syncing to Shopify:', error);
      toast.error('Failed to sync to Shopify - check console for details');
    }
  };

  const handleConfirmUpdate = () => {
    if (pendingFormData) {
      handleFormSubmission(pendingFormData);
    }
  };

  const handleCancelUpdate = () => {
    setShowConfirmModal(false);
    setPendingFormData(null);
  };

  const addTag = () => {
    if (tagInput.trim()) {
      const currentTags = form.getValues('tags') || [];
      if (!currentTags.includes(tagInput.trim())) {
        form.setValue('tags', [...currentTags, tagInput.trim()]);
        setTagInput('');
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('tags') || [];
    form.setValue(
      'tags',
      currentTags.filter((tag) => tag !== tagToRemove)
    );
  };

  const addCollection = () => {
    if (collectionInput.trim()) {
      const currentCollections = form.getValues('collections') || [];
      if (!currentCollections.includes(collectionInput.trim())) {
        form.setValue('collections', [
          ...currentCollections,
          collectionInput.trim()
        ]);
        setCollectionInput('');
      }
    }
  };

  const removeCollection = (collectionToRemove: string) => {
    const currentCollections = form.getValues('collections') || [];
    form.setValue(
      'collections',
      currentCollections.filter(
        (collection) => collection !== collectionToRemove
      )
    );
  };

  const addOption = () => {
    appendOption({
      name: '',
      position: optionFields.length + 1
    });
  };

  return (
    <>
      <AlertModal
        isOpen={showConfirmModal}
        onClose={handleCancelUpdate}
        onConfirm={handleConfirmUpdate}
        loading={isLoading}
        title='Confirm Product Update'
        description={`Are you sure you want to update "${initialData?.name}"? This will modify the existing product information.`}
        confirmText='Yes, Update Product'
        cancelText='Cancel'
        variant='default'
      />

      <div className='bg-background min-h-screen'>
        {/* Header */}
        <div className='border-border bg-card border-b'>
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
            <div className='flex h-16 items-center justify-between'>
              <div className='flex items-center gap-4'>
                <Button variant='ghost' size='sm'>
                  <ArrowLeft className='h-4 w-4' />
                </Button>
                <h1 className='text-foreground text-xl font-semibold'>
                  {pageTitle}
                </h1>
              </div>
              <div className='flex items-center gap-3'>
                <Button variant='outline' disabled={isLoading}>
                  Save as draft
                </Button>
                <Button type='submit' form='product-form' disabled={isLoading}>
                  {isLoading
                    ? isEditing
                      ? 'Updating...'
                      : 'Saving...'
                    : isEditing
                      ? 'Update product'
                      : 'Save product'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form id='product-form' onSubmit={form.handleSubmit(onSubmit)}>
            <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
              <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
                {/* Main Content */}
                <div className='space-y-6 lg:col-span-2'>
                  {/* Title */}
                  <Card>
                    <CardContent className='p-6'>
                      <FormField
                        control={form.control}
                        name='title'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input
                                placeholder='Short sleeve t-shirt'
                                {...field}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Description */}
                      <FormField
                        control={form.control}
                        name='description'
                        render={({ field }) => (
                          <FormItem className='mt-6'>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder='Enter product description...'
                                className='min-h-[120px]'
                                {...field}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Media */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Media</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name='images'
                        render={({ field }) => (
                          <FormItem>
                            <div className='border-border rounded-lg border-2 border-dashed p-8 text-center'>
                              <Upload className='text-muted-foreground mx-auto mb-4 h-12 w-12' />
                              <div className='space-y-2'>
                                <div className='flex justify-center gap-4'>
                                  <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                  >
                                    Upload new
                                  </Button>
                                  <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                  >
                                    Select existing
                                  </Button>
                                </div>
                                <p className='text-muted-foreground text-sm'>
                                  Accepts images, videos, or 3D models
                                </p>
                              </div>
                              <FormControl>
                                <FileUploader
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  maxFiles={10}
                                  maxSize={4 * 1024 * 1024}
                                  disabled={isLoading}
                                  className='mt-4'
                                />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Pricing */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Pricing</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-6'>
                      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                        <FormField
                          control={form.control}
                          name='price'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Price</FormLabel>
                              <FormControl>
                                <div className='relative'>
                                  <span className='text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2'>
                                    $
                                  </span>
                                  <Input
                                    type='number'
                                    step='0.01'
                                    placeholder='0.00'
                                    className='pl-8'
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    disabled={isLoading}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name='compare_at_price'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className='flex items-center gap-1'>
                                Compare-at price
                                <HelpCircle className='text-muted-foreground h-4 w-4' />
                              </FormLabel>
                              <FormControl>
                                <div className='relative'>
                                  <span className='text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2'>
                                    $
                                  </span>
                                  <Input
                                    type='number'
                                    step='0.01'
                                    placeholder='0.00'
                                    className='pl-8'
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(
                                        parseFloat(e.target.value) || undefined
                                      )
                                    }
                                    disabled={isLoading}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name='charge_tax'
                        render={({ field }) => (
                          <FormItem className='flex flex-row items-start space-y-0 space-x-3'>
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormLabel>Charge tax on this product</FormLabel>
                          </FormItem>
                        )}
                      />

                      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                        <FormField
                          control={form.control}
                          name='cost_per_item'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className='flex items-center gap-1'>
                                Cost per item
                                <HelpCircle className='text-muted-foreground h-4 w-4' />
                              </FormLabel>
                              <FormControl>
                                <div className='relative'>
                                  <span className='text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2'>
                                    $
                                  </span>
                                  <Input
                                    type='number'
                                    step='0.01'
                                    placeholder='0.00'
                                    className='pl-8'
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(
                                        parseFloat(e.target.value) || undefined
                                      )
                                    }
                                    disabled={isLoading}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div>
                          <label className='text-foreground mb-2 block text-sm font-medium'>
                            Profit
                          </label>
                          <div className='border-input bg-muted text-muted-foreground flex h-10 items-center rounded-md border px-3 py-2'>
                            ${calculateProfit().toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <label className='text-foreground mb-2 block text-sm font-medium'>
                            Margin
                          </label>
                          <div className='border-input bg-muted text-muted-foreground flex h-10 items-center rounded-md border px-3 py-2'>
                            {calculateMargin()}%
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Inventory */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Inventory</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-6'>
                      <FormField
                        control={form.control}
                        name='track_quantity'
                        render={({ field }) => (
                          <FormItem className='flex flex-row items-start space-y-0 space-x-3'>
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormLabel>Track quantity</FormLabel>
                          </FormItem>
                        )}
                      />

                      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                        <FormField
                          control={form.control}
                          name='quantity'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type='number'
                                  placeholder='0'
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  disabled={isLoading}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name='continue_selling'
                        render={({ field }) => (
                          <FormItem className='flex flex-row items-start space-y-0 space-x-3'>
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormLabel>
                              Continue selling when out of stock
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                        <FormField
                          control={form.control}
                          name='handle'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SKU (Stock Keeping Unit)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder=''
                                  {...field}
                                  disabled={isLoading}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name='handle'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Barcode (ISBN, UPC, GTIN, etc.)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder=''
                                  {...field}
                                  disabled={isLoading}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Shipping */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Shipping</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-6'>
                      <FormField
                        control={form.control}
                        name='requires_shipping'
                        render={({ field }) => (
                          <FormItem className='flex flex-row items-start space-y-0 space-x-3'>
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormLabel>This is a physical product</FormLabel>
                          </FormItem>
                        )}
                      />

                      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                        <FormField
                          control={form.control}
                          name='weight'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Weight</FormLabel>
                              <div className='flex'>
                                <FormControl>
                                  <Input
                                    type='number'
                                    step='0.01'
                                    placeholder='0.0'
                                    className='rounded-r-none'
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    disabled={isLoading}
                                  />
                                </FormControl>
                                <div className='border-input bg-muted flex items-center rounded-r-md border border-l-0 px-3'>
                                  <span className='text-muted-foreground text-sm'>
                                    kg
                                  </span>
                                </div>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='flex items-center gap-2'
                      >
                        <Plus className='h-4 w-4' />
                        Add customs information
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Variants */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Variants</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='flex items-center gap-2'
                        onClick={addOption}
                        disabled={isLoading || optionFields.length >= 3}
                      >
                        <Plus className='h-4 w-4' />
                        Add options like size or color
                      </Button>

                      {optionFields.length > 0 && (
                        <div className='mt-4 space-y-4'>
                          {optionFields.map((field, index) => (
                            <div
                              key={field.id}
                              className='flex items-end gap-2'
                            >
                              <FormField
                                control={form.control}
                                name={`options.${index}.name`}
                                render={({ field }) => (
                                  <FormItem className='flex-1'>
                                    <FormLabel>Option name</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder='Size'
                                        disabled={isLoading}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                onClick={() => removeOption(index)}
                                disabled={isLoading}
                              >
                                <X className='h-4 w-4' />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Search Engine Listing */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Search engine listing</CardTitle>
                      <p className='text-muted-foreground text-sm'>
                        Add a title and description to see how this product
                        might appear in a search engine listing
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className='bg-muted rounded-lg p-4'>
                        <p className='text-muted-foreground text-sm'>
                          Preview coming soon
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
                <div className='space-y-6'>
                  {/* Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name='status'
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={isLoading}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value='active'>Active</SelectItem>
                                <SelectItem value='draft'>Draft</SelectItem>
                                <SelectItem value='archived'>
                                  Archived
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Publishing */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Publishing</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <div className='flex items-center gap-2'>
                        <div className='h-2 w-2 rounded-full bg-green-500'></div>
                        <span className='text-sm'>Online Store</span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <div className='h-2 w-2 rounded-full bg-green-500'></div>
                        <span className='text-sm'>Point of Sale</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Product Organization */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Product organization</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <FormField
                        control={form.control}
                        name='type'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <FormControl>
                              <Input
                                placeholder=''
                                {...field}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='vendor'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vendor</FormLabel>
                            <FormControl>
                              <Input
                                placeholder=''
                                {...field}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='collections'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Collections</FormLabel>
                            <FormControl>
                              <Input
                                placeholder='Search collections'
                                value={collectionInput}
                                onChange={(e) =>
                                  setCollectionInput(e.target.value)
                                }
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addCollection();
                                  }
                                }}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <div className='mt-2 flex flex-wrap gap-2'>
                              {(field.value || []).map((collection, index) => (
                                <Badge
                                  key={index}
                                  variant='secondary'
                                  className='flex items-center gap-1'
                                >
                                  {collection}
                                  <button
                                    type='button'
                                    onClick={() => removeCollection(collection)}
                                    className='hover:text-destructive ml-1'
                                    disabled={isLoading}
                                  >
                                    <X className='h-3 w-3' />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='tags'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tags</FormLabel>
                            <FormControl>
                              <Input
                                placeholder='Search tags'
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addTag();
                                  }
                                }}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <div className='mt-2 flex flex-wrap gap-2'>
                              {(field.value || []).map((tag, index) => (
                                <Badge
                                  key={index}
                                  variant='secondary'
                                  className='flex items-center gap-1'
                                >
                                  {tag}
                                  <button
                                    type='button'
                                    onClick={() => removeTag(tag)}
                                    className='hover:text-destructive ml-1'
                                    disabled={isLoading}
                                  >
                                    <X className='h-3 w-3' />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Marketplace Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Marketplace Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name='marketplace'
                        render={() => (
                          <FormItem>
                            <FormLabel className='text-base'>
                              Available Marketplaces
                            </FormLabel>

                            {/* Shopify Connection Warning */}
                            {hasShopifyConnection === false && (
                              <Alert className='mt-4 mb-4'>
                                <AlertDescription>
                                  ⚠️ No Shopify store connected. To sync
                                  products to Shopify, please{' '}
                                  <a
                                    href='/dashboard/connections'
                                    className='text-primary font-medium hover:underline'
                                    target='_blank'
                                  >
                                    connect your Shopify store
                                  </a>{' '}
                                  first.
                                </AlertDescription>
                              </Alert>
                            )}

                            <div className='mt-4 space-y-3'>
                              {['Shopify', 'Amazon'].map((marketplace) => (
                                <FormField
                                  key={marketplace}
                                  control={form.control}
                                  name='marketplace'
                                  render={({ field }) => {
                                    const isShopifyDisabled =
                                      marketplace === 'Shopify' &&
                                      hasShopifyConnection === false;
                                    return (
                                      <FormItem
                                        key={marketplace}
                                        className='flex flex-row items-start space-y-0 space-x-3'
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(
                                              marketplace as
                                                | 'Shopify'
                                                | 'Amazon'
                                            )}
                                            disabled={
                                              isLoading || isShopifyDisabled
                                            }
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([
                                                    ...field.value,
                                                    marketplace
                                                  ])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) =>
                                                        value !== marketplace
                                                    )
                                                  );
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel
                                          className={`text-base font-normal ${isShopifyDisabled ? 'text-muted-foreground' : ''}`}
                                        >
                                          {marketplace}
                                          {isShopifyDisabled &&
                                            ' (No connection)'}
                                        </FormLabel>
                                      </FormItem>
                                    );
                                  }}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </>
  );
}
