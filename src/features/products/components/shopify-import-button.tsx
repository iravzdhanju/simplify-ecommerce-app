'use client';

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { useImportNotificationStore } from '@/stores/import-notification-store';
import { productsApi } from '@/lib/api/products';
import { toast } from 'sonner';

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
  const { startImport, getActiveImport } = useImportNotificationStore();
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

    setIsImporting(true);
    setImportResult(null);

    // Start the import notification
    const importId = startImport('shopify', 'Your Store');

    try {
      const result = await productsApi.bulkImportFromShopify();

      if (result.success) {
        setImportResult(result.data);
        toast.success('Manual import completed!');
        onImportComplete?.();
      } else {
        toast.error(result.message);
        setImportResult(result.data);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Import failed';
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

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant='outline'
          className='gap-2'
          disabled={hasActiveImport || isImporting}
        >
          {hasActiveImport ? (
            <Icons.spinner className='h-4 w-4 animate-spin' />
          ) : (
            <Icons.store className='h-4 w-4' />
          )}
          {hasActiveImport ? 'Import in Progress...' : 'Import from Shopify'}
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Import Products from Shopify</DialogTitle>
          <DialogDescription>
            This will import all products from your connected Shopify store to
            your local database. Existing products (by SKU or title) will be
            skipped.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {hasActiveImport && (
            <Alert>
              <Icons.spinner className='h-4 w-4 animate-spin' />
              <AlertDescription>
                An import is already in progress. Check the notification in the
                bottom-right corner for progress updates.
              </AlertDescription>
            </Alert>
          )}

          {!importResult && !isImporting && !hasActiveImport && (
            <Alert>
              <Icons.help className='h-4 w-4' />
              <AlertDescription>
                This process may take a few minutes depending on how many
                products you have. You can continue using the app while import
                runs in the background.
              </AlertDescription>
            </Alert>
          )}

          {isImporting && (
            <div className='flex items-center justify-center py-8'>
              <div className='space-y-3 text-center'>
                <Icons.spinner className='mx-auto h-8 w-8 animate-spin' />
                <p className='text-muted-foreground text-sm'>
                  Importing products from Shopify...
                </p>
                <p className='text-muted-foreground text-xs'>
                  This may take a few minutes
                </p>
              </div>
            </div>
          )}

          {importResult && (
            <div className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='rounded-lg bg-green-50 p-3 text-center dark:bg-green-950'>
                  <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
                    {importResult.imported}
                  </div>
                  <div className='text-sm text-green-600 dark:text-green-400'>
                    Imported
                  </div>
                </div>
                <div className='rounded-lg bg-yellow-50 p-3 text-center dark:bg-yellow-950'>
                  <div className='text-2xl font-bold text-yellow-600 dark:text-yellow-400'>
                    {importResult.skipped}
                  </div>
                  <div className='text-sm text-yellow-600 dark:text-yellow-400'>
                    Skipped
                  </div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <Alert variant='destructive'>
                  <Icons.warning className='h-4 w-4' />
                  <AlertDescription>
                    <div className='space-y-1'>
                      <p className='font-medium'>
                        {importResult.errors.length} error(s) occurred:
                      </p>
                      <div className='max-h-32 space-y-1 overflow-y-auto'>
                        {importResult.errors.slice(0, 3).map((error, index) => (
                          <p key={index} className='font-mono text-xs'>
                            {error}
                          </p>
                        ))}
                        {importResult.errors.length > 3 && (
                          <p className='text-muted-foreground text-xs'>
                            ...and {importResult.errors.length - 3} more errors
                          </p>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className='flex gap-2'>
                <Button onClick={resetDialog} className='flex-1'>
                  Done
                </Button>
                {importResult.imported > 0 && (
                  <Button
                    variant='outline'
                    onClick={() => {
                      resetDialog();
                      window.location.reload();
                    }}
                    className='flex-1'
                  >
                    Refresh Page
                  </Button>
                )}
              </div>
            </div>
          )}

          {!importResult && !isImporting && (
            <div className='flex gap-2'>
              <Button
                onClick={resetDialog}
                variant='outline'
                className='flex-1'
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                className='flex-1'
                disabled={hasActiveImport}
              >
                {hasActiveImport ? 'Import Active' : 'Start Import'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
