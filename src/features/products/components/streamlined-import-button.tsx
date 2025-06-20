'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useImportStatus } from '@/hooks/use-import-status';
import { toast } from 'sonner';

interface StreamlinedImportButtonProps {
  onImportComplete?: () => void;
}

export function StreamlinedImportButton({
  onImportComplete
}: StreamlinedImportButtonProps) {
  const { isImporting, startImport } = useImportStatus();

  const handleImport = async () => {
    if (isImporting) {
      toast.error(
        'Import is already in progress. Please wait for it to complete.'
      );
      return;
    }

    const success = await startImport();

    if (success) {
      toast.success(
        'Import started! You can track progress in the notification.'
      );
      onImportComplete?.();
    } else {
      toast.error(
        'Failed to start import. Please check your Shopify connection.'
      );
    }
  };

  return (
    <Button
      variant='outline'
      className='gap-2'
      onClick={handleImport}
      disabled={isImporting}
    >
      {isImporting ? (
        <Icons.spinner className='h-4 w-4 animate-spin' />
      ) : (
        <Icons.store className='h-4 w-4' />
      )}
      {isImporting ? 'Import in Progress...' : 'Import from Shopify'}
    </Button>
  );
}
