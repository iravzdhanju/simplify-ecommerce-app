'use client';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Product } from '@/constants/data';
import { Column, ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, Text, XCircle, Store } from 'lucide-react';
import Image from 'next/image';
import { CellAction } from './cell-action';
import { CATEGORY_OPTIONS, MARKETPLACE_OPTIONS } from './options';

// Helper functions for text cleanup
function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '');
}

/**
 * Character-based truncate that keeps exactly `maxLength` characters (including ellipsis).
 * 1. Collapses whitespace so count is predictable.
 * 2. Returns as-is when under limit.
 */

function truncate(text: string, maxLength = 100): string {
  if (!text) return '';

  const ellipsis = '…';
  const normalised = text.replace(/\s+/g, ' ').trim();

  if (normalised.length <= maxLength) return normalised;

  const sliceLength = Math.max(maxLength - ellipsis.length, 0);
  return normalised.slice(0, sliceLength).trimEnd() + ellipsis;
}

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'photo_url',
    header: 'IMAGE',
    cell: ({ row }) => {
      const imageUrl = row.getValue('photo_url') as string;

      // Don't show placeholder images - only show real images
      if (
        !imageUrl ||
        imageUrl.includes('placeholder-product') ||
        imageUrl.includes('placeholder.com')
      ) {
        return (
          <div className='bg-muted text-muted-foreground flex aspect-square items-center justify-center rounded-lg'>
            <span className='text-xs'>No Image</span>
          </div>
        );
      }

      return (
        <div className='relative aspect-square'>
          <Image
            src={imageUrl}
            alt='Product Image'
            fill
            className='rounded-lg'
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
    cell: ({ cell }) => <div>{cell.getValue<Product['name']>()}</div>,
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
    id: 'marketplace',
    accessorKey: 'marketplace',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='Marketplace' />
    ),
    cell: ({ cell }) => {
      const marketplaces = cell.getValue<Product['marketplace']>();

      return (
        <div className='flex flex-wrap gap-1'>
          {marketplaces.map((marketplace) => (
            <Badge
              key={marketplace}
              variant={marketplace === 'Shopify' ? 'default' : 'secondary'}
              className='capitalize'
            >
              <Store className='mr-1 h-3 w-3' />
              {marketplace}
            </Badge>
          ))}
        </div>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'marketplaces',
      variant: 'multiSelect',
      options: MARKETPLACE_OPTIONS,
      icon: Store
    }
  },
  {
    accessorKey: 'price',
    header: 'PRICE'
  },
  {
    accessorKey: 'description',
    header: 'DESCRIPTION',
    cell: ({ cell }) => {
      const raw = cell.getValue<Product['description']>() || '';
      const cleaned = stripHtml(raw);
      const truncated = truncate(cleaned, 55);
      return <div title={cleaned}>{truncated}</div>;
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
