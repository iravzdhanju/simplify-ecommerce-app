'use client';

import { useEffect } from 'react';
import { useImportNotificationStore } from '@/stores/import-notification-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { productsApi } from '@/lib/api/products';

export function ImportNotification() {
  const {
    activeImports,
    updateImportProgress,
    completeImport,
    dismissImport,
    hasActiveImports
  } = useImportNotificationStore();

  // Auto-polling for import progress
  useEffect(() => {
    const activeImport = activeImports.find(
      (imp) => imp.status === 'pending' || imp.status === 'importing'
    );

    if (!activeImport) return;

    const pollInterval = setInterval(async () => {
      try {
        // Check import status without triggering new import
        const response = await fetch('/api/sync/shopify/bulk/status');

        if (response.ok) {
          const result = await response.json();

          if (result.success) {
            const { isActive, imported, totalProducts, errors, errorMessages } =
              result.data;

            if (imported > 0 || totalProducts > 0) {
              if (isActive) {
                // Import is still in progress
                updateImportProgress(activeImport.id, {
                  imported,
                  total: totalProducts,
                  errors: errorMessages || []
                });
              } else {
                // Import has completed
                completeImport(activeImport.id, true);

                // Update progress one final time
                updateImportProgress(activeImport.id, {
                  imported,
                  total: totalProducts,
                  errors: errorMessages || []
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error polling import progress:', error);

        // If polling fails consistently, mark as error after 5 minutes
        const timeSinceStart =
          Date.now() - new Date(activeImport.startedAt).getTime();
        if (timeSinceStart > 5 * 60 * 1000) {
          // 5 minutes
          completeImport(activeImport.id, false, 'Import timed out');
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [activeImports, updateImportProgress, completeImport]);

  if (activeImports.length === 0) return null;

  return (
    <>
      {hasActiveImports() && (
        <div className='animate-in slide-in-from-bottom-5 fade-in-0 fixed right-4 bottom-4 z-50 w-96 max-w-[calc(100vw-2rem)] duration-300'>
          {activeImports.map((importStatus) => (
            <Card
              key={importStatus.id}
              className='mb-4 border-l-4 border-l-blue-500 shadow-lg'
            >
              <CardContent className='p-4'>
                <div className='mb-2 flex items-start justify-between'>
                  <div className='flex items-center gap-2'>
                    <Icons.store className='h-4 w-4 text-blue-500' />
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
                          'Import completed!'}
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
                      className='text-xs'
                    >
                      {importStatus.status}
                    </Badge>
                    {(importStatus.status === 'completed' ||
                      importStatus.status === 'error') && (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => dismissImport(importStatus.id)}
                        className='h-6 w-6 p-0'
                      >
                        <Icons.close className='h-3 w-3' />
                      </Button>
                    )}
                  </div>
                </div>

                {importStatus.status === 'pending' && (
                  <div className='flex items-center gap-2'>
                    <Icons.spinner className='h-4 w-4 animate-spin' />
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
                      {/* Simple progress bar without external component */}
                      <div className='h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700'>
                        <div
                          className='h-2 rounded-full bg-blue-600 transition-all duration-300 ease-in-out'
                          style={{
                            width: `${(importStatus.progress.imported / importStatus.progress.total) * 100}%`
                          }}
                        />
                      </div>
                      {importStatus.progress.errors.length > 0 && (
                        <p className='text-xs text-yellow-600'>
                          {importStatus.progress.errors.length} errors occurred
                        </p>
                      )}
                    </div>
                  )}

                {importStatus.status === 'completed' &&
                  importStatus.progress && (
                    <div className='space-y-2'>
                      <div className='flex items-center gap-2 text-green-600'>
                        <Icons.check className='h-4 w-4' />
                        <span className='text-sm font-medium'>
                          Successfully imported {importStatus.progress.imported}{' '}
                          products!
                        </span>
                      </div>
                      {importStatus.progress.errors.length > 0 && (
                        <p className='text-muted-foreground text-xs'>
                          {importStatus.progress.errors.length} products had
                          errors
                        </p>
                      )}
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          (window.location.href = '/dashboard/product')
                        }
                        className='w-full'
                      >
                        View Products
                      </Button>
                    </div>
                  )}

                {importStatus.status === 'error' && (
                  <div className='space-y-2'>
                    <div className='flex items-center gap-2 text-red-600'>
                      <Icons.warning className='h-4 w-4' />
                      <span className='text-sm font-medium'>Import failed</span>
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      {importStatus.errorMessage ||
                        'An error occurred during import'}
                    </p>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        (window.location.href = '/dashboard/product')
                      }
                      className='w-full'
                    >
                      Try Manual Import
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
