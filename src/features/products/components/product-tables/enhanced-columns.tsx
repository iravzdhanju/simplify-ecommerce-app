'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Product } from '@/lib/api/products';
import { productsApi } from '@/lib/api/products';
import { Column, ColumnDef } from '@tanstack/react-table';
import {
  CheckCircle2,
  Text,
  XCircle,
  Loader2,
  ExternalLink,
  AlertCircle,
  Clock
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { CellAction } from './cell-action';
import { CATEGORY_OPTIONS } from './options';

// Enhanced Cell Action with Sync functionality
function EnhancedCellAction({ data }: { data: Product }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await productsApi.syncToShopify(data.id, 'update');

      if (result.success) {
        toast.success('Product synced to Shopify successfully');
        // Trigger a refresh of the table data
        window.location.reload();
      } else {
        toast.error(`Sync failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync product');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className='flex items-center gap-2'>
      <Button
        variant='outline'
        size='sm'
        onClick={handleSync}
        disabled={syncing}
        className='h-8'
      >
        {syncing ? <Loader2 className='h-3 w-3 animate-spin' /> : <>Syncing </>}
      </Button>
      <CellAction data={data} />
    </div>
  );
}

// Sync Status Cell Component
function SyncStatusCell({ product }: { product: Product }) {
  const syncStatus = product.sync_status?.shopify;

  if (!syncStatus) {
    return (
      <Badge variant='secondary'>
        <Clock className='mr-1 h-3 w-3' />
        Not Synced
      </Badge>
    );
  }

  switch (syncStatus) {
    case 'success':
      return (
        <div className='space-y-1'>
          <Badge variant='default' className='bg-green-500'>
            <CheckCircle2 className='mr-1 h-3 w-3' />
            Synced
          </Badge>
          {product.sync_status?.last_synced && (
            <div className='text-muted-foreground text-xs'>
              {new Date(product.sync_status.last_synced).toLocaleDateString()}
            </div>
          )}
        </div>
      );
    case 'error':
      return (
        <div className='space-y-1'>
          <Badge variant='destructive'>
            <XCircle className='mr-1 h-3 w-3' />
            Error
          </Badge>
          {product.sync_status?.error_message && (
            <div
              className='max-w-32 truncate text-xs text-red-600'
              title={product.sync_status.error_message}
            >
              {product.sync_status.error_message}
            </div>
          )}
        </div>
      );
    case 'pending':
      return (
        <Badge variant='secondary'>
          <Clock className='mr-1 h-3 w-3' />
          Pending
        </Badge>
      );
    case 'syncing':
      return (
        <Badge variant='secondary'>
          <Loader2 className='mr-1 h-3 w-3 animate-spin' />
          Syncing
        </Badge>
      );
    default:
      return (
        <Badge variant='outline'>
          <AlertCircle className='mr-1 h-3 w-3' />
          Unknown
        </Badge>
      );
  }
}

export const enhancedColumns: ColumnDef<Product>[] = [
  {
    accessorKey: 'photo_url',
    header: 'IMAGE',
    cell: ({ row }) => {
      const imageUrl = row.getValue('photo_url') as string;
      const productName = row.getValue('name') as string;

      // Don't show placeholder images - only show real images
      if (
        !imageUrl ||
        imageUrl.includes('placeholder-product') ||
        imageUrl.includes('placeholder.com')
      ) {
        return (
          <div className='bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-lg'>
            <span className='text-xs'>No Image</span>
          </div>
        );
      }

      return (
        <div className='relative aspect-square h-12 w-12'>
          <Image
            src={imageUrl}
            alt={productName || 'Product image'}
            fill
            className='rounded-lg object-cover'
            onError={(e) => {
              console.warn('Image failed to load:', imageUrl);
              // Hide the image completely on error instead of showing placeholder
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      );
    }
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => {
      const product = row.original;
      return (
        <div className='space-y-1'>
          <div className='font-medium'>{product.name}</div>
          {product.sku && (
            <div className='text-muted-foreground text-xs'>
              SKU: {product.sku}
            </div>
          )}
          {product.brand && (
            <div className='text-muted-foreground text-xs'>{product.brand}</div>
          )}
        </div>
      );
    },
    meta: {
      label: 'Name',
      placeholder: 'Search products...',
      variant: 'text',
      icon: Text
    },
    enableColumnFilter: true
  },
  {
    id: 'category',
    accessorKey: 'category',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='Category' />
    ),
    cell: ({ cell }) => {
      const category = cell.getValue<Product['category']>();

      return (
        <Badge variant='outline' className='capitalize'>
          {category}
        </Badge>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'categories',
      variant: 'multiSelect',
      options: CATEGORY_OPTIONS
    }
  },
  {
    accessorKey: 'price',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Price' />
    ),
    cell: ({ row }) => {
      const price = row.getValue('price') as number;
      return <div className='font-medium'>${price?.toFixed(2) || '0.00'}</div>;
    }
  },
  {
    accessorKey: 'inventory',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Stock' />
    ),
    cell: ({ row }) => {
      const inventory = row.original.inventory || 0;
      const isLowStock = inventory < 10;

      return (
        <div className={`font-medium ${isLowStock ? 'text-red-600' : ''}`}>
          {inventory}
          {isLowStock && inventory > 0 && (
            <span className='ml-1 text-xs'>(Low)</span>
          )}
          {inventory === 0 && <span className='ml-1 text-xs'>(Out)</span>}
        </div>
      );
    }
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const status = row.original.status;

      const statusConfig = {
        active: {
          variant: 'default' as const,
          icon: CheckCircle2,
          color: 'bg-green-500'
        },
        inactive: { variant: 'secondary' as const, icon: XCircle, color: '' },
        draft: { variant: 'outline' as const, icon: Clock, color: '' }
      };

      const config =
        statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
      const Icon = config.icon;

      return (
        <Badge
          variant={config.variant}
          className={`capitalize ${config.color}`}
        >
          <Icon className='mr-1 h-3 w-3' />
          {status}
        </Badge>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'status',
      variant: 'multiSelect',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Draft', value: 'draft' }
      ]
    }
  },
  {
    id: 'sync_status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Shopify Sync' />
    ),
    cell: ({ row }) => {
      return <SyncStatusCell product={row.original} />;
    },
    enableColumnFilter: true,
    meta: {
      label: 'sync_status',
      variant: 'multiSelect',
      options: [
        { label: 'Synced', value: 'success' },
        { label: 'Error', value: 'error' },
        { label: 'Pending', value: 'pending' },
        { label: 'Not Synced', value: 'none' }
      ]
    }
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tags = row.original.tags || [];

      if (tags.length === 0) return null;

      return (
        <div className='flex max-w-32 flex-wrap gap-1'>
          {tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant='secondary' className='text-xs'>
              {tag}
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge variant='secondary' className='text-xs'>
              +{tags.length - 2}
            </Badge>
          )}
        </div>
      );
    }
  },
  {
    accessorKey: 'updated_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Updated' />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('updated_at'));
      return (
        <div className='text-muted-foreground text-sm'>
          {date.toLocaleDateString()}
        </div>
      );
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => <EnhancedCellAction data={row.original} />
  }
];
