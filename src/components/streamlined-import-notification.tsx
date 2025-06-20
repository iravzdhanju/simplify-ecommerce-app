'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Icons } from '@/components/icons';
import { useImportStatus } from '@/hooks/use-import-status';

export function StreamlinedImportNotification() {
  const { status, isImporting, clearCompleted } = useImportStatus();

  if (status.status === 'idle') {
    return null;
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'completed':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getProgressPercentage = () => {
    if (!status.progress || status.progress.total === 0) return 0;
    return Math.round((status.progress.imported / status.progress.total) * 100);
  };

  const canDismiss = status.status === 'completed' || status.status === 'error';

  return (
    <div className='fixed right-4 bottom-4 z-50 w-96 max-w-[calc(100vw-2rem)]'>
      <Card className='animate-in slide-in-from-bottom-5 fade-in-0 border-l-4 border-l-blue-500 shadow-lg'>
        <CardContent className='p-4'>
          <div className='mb-2 flex items-start justify-between'>
            <div className='flex items-center gap-2'>
              <Icons.store className='h-4 w-4 text-blue-500' />
              <div>
                <p className='text-sm font-medium'>Shopify Import</p>
                <p className='text-muted-foreground text-xs'>
                  {status.status === 'pending' && 'Starting import...'}
                  {status.status === 'importing' && 'Importing products...'}
                  {status.status === 'completed' && 'Import completed!'}
                  {status.status === 'error' && 'Import failed'}
                </p>
              </div>
            </div>
            <div className='flex items-center gap-1'>
              <Badge variant={getStatusColor()} className='text-xs'>
                {status.status}
              </Badge>
              {canDismiss && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={clearCompleted}
                  className='h-6 w-6 p-0'
                >
                  <Icons.close className='h-3 w-3' />
                </Button>
              )}
            </div>
          </div>

          {/* Loading state */}
          {status.status === 'pending' && (
            <div className='flex items-center gap-2'>
              <Icons.spinner className='h-4 w-4 animate-spin' />
              <p className='text-muted-foreground text-sm'>
                Connecting to your Shopify store...
              </p>
            </div>
          )}

          {/* Progress state */}
          {status.status === 'importing' && status.progress && (
            <div className='space-y-2'>
              <div className='flex justify-between text-sm'>
                <span>
                  {status.progress.imported} of {status.progress.total} products
                </span>
                <span>{getProgressPercentage()}%</span>
              </div>
              <Progress value={getProgressPercentage()} className='h-2' />
              {status.progress.errors.length > 0 && (
                <p className='text-xs text-yellow-600'>
                  {status.progress.errors.length} errors occurred
                </p>
              )}
            </div>
          )}

          {/* Completed state */}
          {status.status === 'completed' && status.progress && (
            <div className='space-y-2'>
              <div className='flex items-center gap-2 text-green-600'>
                <Icons.check className='h-4 w-4' />
                <span className='text-sm font-medium'>
                  Successfully imported {status.progress.imported} products!
                </span>
              </div>
              {status.progress.errors.length > 0 && (
                <p className='text-muted-foreground text-xs'>
                  {status.progress.errors.length} products had errors
                </p>
              )}
              <Button
                variant='outline'
                size='sm'
                onClick={() => (window.location.href = '/dashboard/product')}
                className='w-full'
              >
                View Products
              </Button>
            </div>
          )}

          {/* Error state */}
          {status.status === 'error' && (
            <div className='space-y-2'>
              <div className='flex items-center gap-2 text-red-600'>
                <Icons.warning className='h-4 w-4' />
                <span className='text-sm font-medium'>Import failed</span>
              </div>
              <p className='text-muted-foreground text-xs'>
                {status.errorMessage || 'An error occurred during import'}
              </p>
              <Button
                variant='outline'
                size='sm'
                onClick={() => (window.location.href = '/dashboard/product')}
                className='w-full'
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
