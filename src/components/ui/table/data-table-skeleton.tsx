import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface DataTableToolbarSkeletonProps extends React.ComponentProps<'div'> {
  filterCount?: number;
  withViewOptions?: boolean;
}

export function DataTableToolbarSkeleton({
  filterCount = 0,
  withViewOptions = true,
  className,
  ...props
}: DataTableToolbarSkeletonProps) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-2 overflow-auto p-1',
        className
      )}
      {...props}
    >
      <div className='flex flex-1 items-center gap-2'>
        {filterCount > 0
          ? Array.from({ length: filterCount }).map((_, i) => (
              <Skeleton key={i} className='h-7 w-[4.5rem] border-dashed' />
            ))
          : null}
      </div>
      {withViewOptions ? (
        <Skeleton className='ml-auto hidden h-7 w-[4.5rem] lg:flex' />
      ) : null}
    </div>
  );
}

interface DataTableContentSkeletonProps extends React.ComponentProps<'div'> {
  columnCount: number;
  rowCount?: number;
  cellWidths?: string[];
  shrinkZero?: boolean;
}

export function DataTableContentSkeleton({
  columnCount,
  rowCount = 10,
  cellWidths = ['auto'],
  shrinkZero = false,
  className,
  ...props
}: DataTableContentSkeletonProps) {
  const cozyCellWidths = Array.from(
    { length: columnCount },
    (_, index) => cellWidths[index % cellWidths.length] ?? 'auto'
  );

  return (
    <div className={cn('flex-1 rounded-md border', className)} {...props}>
      <Table>
        <TableHeader>
          {Array.from({ length: 1 }).map((_, i) => (
            <TableRow key={i} className='hover:bg-transparent'>
              {Array.from({ length: columnCount }).map((_, j) => (
                <TableHead
                  key={j}
                  style={{
                    width: cozyCellWidths[j],
                    minWidth: shrinkZero ? cozyCellWidths[j] : 'auto'
                  }}
                >
                  <Skeleton className='h-6 w-full' />
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, i) => (
            <TableRow key={i} className='hover:bg-transparent'>
              {Array.from({ length: columnCount }).map((_, j) => (
                <TableCell
                  key={j}
                  style={{
                    width: cozyCellWidths[j],
                    minWidth: shrinkZero ? cozyCellWidths[j] : 'auto'
                  }}
                >
                  <Skeleton className='h-6 w-full' />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface DataTablePaginationSkeletonProps
  extends React.ComponentProps<'div'> {}

export function DataTablePaginationSkeleton({
  className,
  ...props
}: DataTablePaginationSkeletonProps) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-4 overflow-auto p-1 sm:gap-8',
        className
      )}
      {...props}
    >
      <Skeleton className='h-7 w-40 shrink-0' />
      <div className='flex items-center gap-4 sm:gap-6 lg:gap-8'>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-7 w-24' />
          <Skeleton className='h-7 w-[4.5rem]' />
        </div>
        <div className='flex items-center justify-center text-sm font-medium'>
          <Skeleton className='h-7 w-20' />
        </div>
        <div className='flex items-center gap-2'>
          <Skeleton className='hidden size-7 lg:block' />
          <Skeleton className='size-7' />
          <Skeleton className='size-7' />
          <Skeleton className='hidden size-7 lg:block' />
        </div>
      </div>
    </div>
  );
}

interface DataTableSkeletonProps extends React.ComponentProps<'div'> {
  columnCount: number;
  rowCount?: number;
  filterCount?: number;
  cellWidths?: string[];
  withViewOptions?: boolean;
  withPagination?: boolean;
  shrinkZero?: boolean;
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 10,
  filterCount = 0,
  cellWidths = ['auto'],
  withViewOptions = true,
  withPagination = true,
  shrinkZero = false,
  className,
  ...props
}: DataTableSkeletonProps) {
  return (
    <div className={cn('flex flex-1 flex-col space-y-4', className)} {...props}>
      <DataTableToolbarSkeleton
        filterCount={filterCount}
        withViewOptions={withViewOptions}
      />

      <DataTableContentSkeleton
        columnCount={columnCount}
        rowCount={rowCount}
        cellWidths={cellWidths}
        shrinkZero={shrinkZero}
      />

      {withPagination ? <DataTablePaginationSkeleton /> : null}
    </div>
  );
}
