'use client';

import { useEffect } from 'react';
import { useImportNotificationStore } from '@/stores/import-notification-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ImportNotification() {
  const {
    activeImports,
    dismissImport,
    shouldShowNotifications,
    checkConnections,
    connectionLoading,
    hasConnection
  } = useImportNotificationStore();

  // Initialize connection checking on mount
  useEffect(() => {
    checkConnections();
  }, [checkConnections]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-l-green-500 dark:border-l-green-400';
      case 'error':
        return 'border-l-red-500 dark:border-l-red-400';
      case 'importing':
        return 'border-l-primary';
      default:
        return 'border-l-primary';
    }
  };

  const getIconColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-primary';
    }
  };

  // Show debug info in development
  if (process.env.NODE_ENV === 'development') {
    console.log('ImportNotification Debug:', {
      connectionLoading,
      hasConnection,
      activeImports: activeImports.length,
      shouldShow: shouldShowNotifications()
    });
  }

  // Don't show notifications if conditions aren't met
  if (!shouldShowNotifications()) {
    return null;
  }

  return (
    <>
      {activeImports.length > 0 && (
        <div className='animate-in slide-in-from-bottom-5 fade-in-0 fixed right-4 bottom-4 z-50 w-96 max-w-[calc(100vw-2rem)] duration-300'>
          {activeImports.map((importStatus) => (
            <Card
              key={importStatus.id}
              className={cn(
                'mb-4 border-l-4 shadow-lg transition-all duration-500',
                getStatusColor(importStatus.status),
                importStatus.status === 'completed' && 'animate-pulse-once'
              )}
            >
              <CardContent className='p-0'>
                <div className='px-4'>
                  <div className='mb-2 flex items-start justify-between'>
                    <div className='flex items-center gap-2'>
                      <Icons.store
                        className={cn(
                          'h-4 w-4',
                          getIconColor(importStatus.status)
                        )}
                      />
                      <div>
                        <p className='text-sm font-medium'>
                          Importing from {importStatus.shopName}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {importStatus.status === 'pending' &&
                            'Starting import...'}
                          {importStatus.status === 'importing' &&
                            'Importing products...'}
                          {importStatus.status === 'completed' &&
                            'Import completed successfully! 🎉'}
                          {importStatus.status === 'error' && 'Import failed'}
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center gap-1'>
                      <Badge
                        variant={
                          importStatus.status === 'completed'
                            ? 'default'
                            : importStatus.status === 'error'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className={cn(
                          'text-xs transition-colors',
                          importStatus.status === 'completed' &&
                            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                        )}
                      >
                        {importStatus.status}
                      </Badge>
                      {(importStatus.status === 'completed' ||
                        importStatus.status === 'error') && (
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => dismissImport(importStatus.id)}
                          className='hover:bg-muted h-6 w-6 p-0'
                        >
                          <Icons.close className='h-3 w-3' />
                        </Button>
                      )}
                    </div>
                  </div>

                  {importStatus.status === 'pending' && (
                    <div className='flex items-center gap-2'>
                      <Icons.spinner className='text-primary h-4 w-4 animate-spin' />
                      <p className='text-muted-foreground text-sm'>
                        Connecting to your Shopify store...
                      </p>
                    </div>
                  )}

                  {importStatus.status === 'importing' &&
                    importStatus.progress && (
                      <div className='space-y-2'>
                        <div className='flex justify-between text-sm'>
                          <span>
                            {importStatus.progress.imported} of{' '}
                            {importStatus.progress.total} products
                          </span>
                          <span>
                            {Math.round(
                              (importStatus.progress.imported /
                                importStatus.progress.total) *
                                100
                            )}
                            %
                          </span>
                        </div>
                        {/* Theme-aware progress bar */}
                        <div className='bg-muted h-2 w-full rounded-full'>
                          <div
                            className='bg-primary h-2 rounded-full transition-all duration-300 ease-in-out'
                            style={{
                              width: `${(importStatus.progress.imported / importStatus.progress.total) * 100}%`
                            }}
                          />
                        </div>
                        {importStatus.progress.errors.length > 0 && (
                          <p className='text-xs text-yellow-600 dark:text-yellow-400'>
                            {importStatus.progress.errors.length} errors
                            occurred
                          </p>
                        )}
                      </div>
                    )}

                  {importStatus.status === 'completed' &&
                    importStatus.progress && (
                      <div className='space-y-3'>
                        <div className='flex items-center gap-2 text-green-600 dark:text-green-400'>
                          <Icons.check className='h-4 w-4' />
                          <span className='text-sm font-medium'>
                            Successfully imported{' '}
                            {importStatus.progress.imported} products!
                          </span>
                        </div>
                        {importStatus.progress.errors.length > 0 && (
                          <p className='text-muted-foreground text-xs'>
                            {importStatus.progress.errors.length} products had
                            errors
                          </p>
                        )}
                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              (window.location.href = '/dashboard/product')
                            }
                            className='flex-1'
                          >
                            View Products
                          </Button>
                        </div>
                      </div>
                    )}

                  {importStatus.status === 'error' && (
                    <div className='space-y-3'>
                      <div className='flex items-center gap-2 text-red-600 dark:text-red-400'>
                        <Icons.warning className='h-4 w-4' />
                        <span className='text-sm font-medium'>
                          Import failed
                        </span>
                      </div>
                      <p className='text-muted-foreground text-xs'>
                        {importStatus.errorMessage ||
                          'An error occurred during import'}
                      </p>
                      <div className='flex gap-2'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() =>
                            (window.location.href = '/dashboard/product')
                          }
                          className='flex-1'
                        >
                          Try Manual Import
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => dismissImport(importStatus.id)}
                          className='px-3'
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
