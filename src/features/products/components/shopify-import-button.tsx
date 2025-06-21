'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { useImportNotificationStore } from '@/stores/import-notification-store';
import { productsApi } from '@/lib/api/products';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function ShopifyImportButton({
  onImportComplete
}: {
  onImportComplete?: () => void;
}) {
  const {
    startImport,
    getActiveImport,
    hasConnection,
    connectionLoading,
    checkConnections,
    updateImportProgress,
    completeImport,
    connections
  } = useImportNotificationStore();

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Check if there's already an active import
  const activeImport = getActiveImport('shopify');
  const hasActiveImport = Boolean(activeImport);

  const handleImport = async () => {
    if (hasActiveImport) {
      toast.error(
        'Import is already in progress. Please wait for it to complete.'
      );
      return;
    }

    if (!hasConnection) {
      toast.error('Please connect your Shopify store first.');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    // Get the shop name from connections
    const shopName = connections[0]?.connection_name || 'Your Store';

    // Start the import notification
    const importId = startImport('shopify', shopName);

    try {
      // Update progress to importing status
      updateImportProgress(importId, {
        imported: 0,
        total: 1,
        errors: []
      });

      const result = await productsApi.bulkImportFromShopify();

      if (result.success) {
        // Update final progress
        updateImportProgress(importId, {
          imported: result.data.imported,
          total: result.data.imported + result.data.skipped,
          errors: result.data.errors
        });

        // Complete the import successfully
        completeImport(importId, true);

        setImportResult(result.data);
        toast.success('Manual import completed!');
        onImportComplete?.();
      } else {
        // Complete the import with error
        completeImport(importId, false, result.message);

        toast.error(result.message);
        setImportResult(result.data);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Import failed';

      // Complete the import with error
      completeImport(importId, false, errorMessage);

      toast.error(errorMessage);
      setImportResult({
        imported: 0,
        skipped: 0,
        errors: [errorMessage]
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetDialog = () => {
    setImportResult(null);
    setIsDialogOpen(false);
  };

  const handleDialogOpen = (open: boolean) => {
    setIsDialogOpen(open);
    if (open && !hasConnection && !connectionLoading) {
      // Refresh connection status when dialog opens
      checkConnections();
    }
  };

  // Don't show button if no connection and not loading
  if (!connectionLoading && !hasConnection) {
    return null;
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant='outline'
          className={cn(
            'gap-2 transition-colors',
            hasActiveImport && 'text-primary border-primary'
          )}
          disabled={hasActiveImport || isImporting || connectionLoading}
        >
          {connectionLoading ? (
            <Icons.spinner className='text-muted-foreground h-4 w-4 animate-spin' />
          ) : hasActiveImport ? (
            <Icons.spinner className='text-primary h-4 w-4 animate-spin' />
          ) : (
            <Icons.store className='h-4 w-4' />
          )}
          {connectionLoading
            ? 'Checking Connection...'
            : hasActiveImport
              ? 'Import in Progress...'
              : 'Import from Shopify'}
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Icons.store className='text-primary h-5 w-5' />
            Import Products from Shopify
          </DialogTitle>
          <DialogDescription>
            This will import all products from your connected Shopify store to
            your local database. Existing products (by SKU or title) will be
            skipped.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {!hasConnection && !connectionLoading && (
            <Alert className='border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'>
              <Icons.warning className='h-4 w-4 text-red-600 dark:text-red-400' />
              <AlertDescription>
                <span className='font-medium text-red-800 dark:text-red-200'>
                  No Shopify connection found
                </span>
                <br />
                <span className='text-sm text-red-700 dark:text-red-300'>
                  Please connect your Shopify store first from the Connections
                  page.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {!importResult && !isImporting && hasConnection && (
            <Alert className='border-primary/20 bg-primary/5'>
              <Icons.help className='text-primary h-4 w-4' />
              <AlertDescription className='text-muted-foreground'>
                This process may take a few minutes depending on the number of
                products in your store.
              </AlertDescription>
            </Alert>
          )}

          {isImporting && (
            <Alert className='border-primary/20 bg-primary/5'>
              <Icons.spinner className='text-primary h-4 w-4 animate-spin' />
              <AlertDescription>
                <span className='text-primary font-medium'>
                  Import in progress...
                </span>
                <br />
                <span className='text-muted-foreground text-sm'>
                  Please don't close this dialog. You can track progress in the
                  notification.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {importResult && (
            <div className='space-y-3'>
              {importResult.imported > 0 && (
                <Alert className='border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'>
                  <Icons.check className='h-4 w-4 text-green-600 dark:text-green-400' />
                  <AlertDescription>
                    <span className='font-medium text-green-800 dark:text-green-200'>
                      Successfully imported {importResult.imported} products!
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {importResult.skipped > 0 && (
                <Alert className='border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'>
                  <Icons.help className='h-4 w-4 text-yellow-600 dark:text-yellow-400' />
                  <AlertDescription>
                    <span className='text-yellow-800 dark:text-yellow-200'>
                      {importResult.skipped} products were skipped (already
                      exist)
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {importResult.errors.length > 0 && (
                <Alert className='border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'>
                  <Icons.warning className='h-4 w-4 text-red-600 dark:text-red-400' />
                  <AlertDescription>
                    <span className='font-medium text-red-800 dark:text-red-200'>
                      {importResult.errors.length} errors occurred:
                    </span>
                    <ul className='mt-2 space-y-1 text-sm text-red-700 dark:text-red-300'>
                      {importResult.errors.slice(0, 3).map((error, index) => (
                        <li key={index} className='list-inside list-disc'>
                          {error}
                        </li>
                      ))}
                      {importResult.errors.length > 3 && (
                        <li className='text-xs text-red-600 dark:text-red-400'>
                          ... and {importResult.errors.length - 3} more errors
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className='flex gap-2 pt-2'>
            {!isImporting && !importResult && hasConnection && (
              <>
                <Button
                  onClick={handleImport}
                  disabled={hasActiveImport}
                  className='flex-1'
                >
                  {hasActiveImport ? (
                    <>
                      <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                      Import in Progress
                    </>
                  ) : (
                    <>
                      <Icons.store className='mr-2 h-4 w-4' />
                      Start Import
                    </>
                  )}
                </Button>
                <Button variant='outline' onClick={resetDialog}>
                  Cancel
                </Button>
              </>
            )}

            {!isImporting && !importResult && !hasConnection && (
              <Button
                variant='outline'
                onClick={() =>
                  (window.location.href = '/dashboard/connections')
                }
                className='flex-1'
              >
                <Icons.link className='mr-2 h-4 w-4' />
                Go to Connections
              </Button>
            )}

            {isImporting && (
              <Button
                variant='outline'
                onClick={resetDialog}
                className='flex-1'
              >
                Close (Import Continues)
              </Button>
            )}

            {importResult && (
              <>
                <Button
                  onClick={() => (window.location.href = '/dashboard/product')}
                  className='flex-1'
                >
                  <Icons.store className='mr-2 h-4 w-4' />
                  View Products
                </Button>
                <Button variant='outline' onClick={resetDialog}>
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
