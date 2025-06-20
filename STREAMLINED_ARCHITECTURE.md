# Streamlined Architecture Guide

This document outlines the improved, maintainable architecture that consolidates scattered import logic into a cohesive system.

## Overview

The previous implementation had several maintainability issues:

- ❌ Import logic scattered across multiple files
- ❌ Complex polling mechanisms in UI components
- ❌ Inconsistent error handling patterns
- ❌ Multiple sources of truth for import status
- ❌ Difficult to debug and extend

The new streamlined architecture addresses these issues:

- ✅ Unified `ImportService` for all import operations
- ✅ Simplified React hooks for status management
- ✅ Standardized API response patterns
- ✅ Clean separation of concerns
- ✅ Easy to test and extend

## Core Components

### 1. ImportService (`src/lib/services/import-service.ts`)

**Central service that handles all import operations.**

```typescript
// Start an import
const result = await importService.startShopifyImport();

// Get status
const status = await importService.getImportStatus(importId);

// Cancel import
await importService.cancelImport(importId);
```

**Features:**

- Singleton pattern for consistent state
- In-memory caching for performance
- Background processing with progress tracking
- Automatic error handling and recovery

### 2. useImportStatus Hook (`src/hooks/use-import-status.ts`)

**Simplified React hook for components.**

```typescript
function MyComponent() {
  const { status, isImporting, startImport, cancelImport, clearCompleted } =
    useImportStatus();

  // Auto-refreshes when import is active
  // Handles all status transitions
}
```

**Benefits:**

- No manual polling logic in components
- Automatic status updates
- Clean API for all import operations
- Built-in error handling

### 3. Streamlined Components

#### Import Button (`src/features/products/components/streamlined-import-button.tsx`)

- Simple one-click import
- No complex dialog state
- Automatic status feedback

#### Import Notification (`src/components/streamlined-import-notification.tsx`)

- Real-time progress updates
- Clean status presentation
- Automatic cleanup

### 4. Standardized API Types (`src/lib/types/api.ts`)

**Consistent response patterns across all endpoints.**

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: unknown;
}

// Helper functions
createSuccessResponse(data, message);
createErrorResponse(error, code);
createAuthError();
```

## Migration Guide

### Replace Complex Components

**Before:**

```typescript
// Complex zustand store with manual polling
const { activeImports, updateImportProgress, completeImport } =
  useImportNotificationStore();

useEffect(() => {
  const pollInterval = setInterval(async () => {
    // Complex polling logic...
  }, 3000);
}, []);
```

**After:**

```typescript
// Simple hook with automatic updates
const { status, isImporting, startImport } = useImportStatus();
// No manual polling needed!
```

### Simplify API Routes

**Before:**

```typescript
export async function POST() {
  try {
    // Scattered validation and error handling
  } catch (error) {
    // Inconsistent error responses
  }
}
```

**After:**

```typescript
export async function POST() {
  try {
    await requireAuth();
    const result = await importService.startShopifyImport();

    return NextResponse.json(
      result.success
        ? createSuccessResponse({ importId: result.importId })
        : createErrorResponse(result.error)
    );
  } catch (error) {
    return NextResponse.json(createAuthError(), { status: 401 });
  }
}
```

## Architecture Benefits

### 1. **Single Source of Truth**

- All import logic centralized in `ImportService`
- No state duplication between components
- Consistent behavior across the app

### 2. **Reduced Complexity**

- Components focus on UI only
- Business logic extracted to services
- No manual state management in components

### 3. **Better Error Handling**

- Standardized error responses
- Consistent error messaging
- Automatic error recovery

### 4. **Improved Performance**

- In-memory caching reduces API calls
- Efficient background processing
- Minimal re-renders

### 5. **Easy Testing**

- Services can be unit tested
- Mock-friendly architecture
- Clear boundaries between layers

## Usage Examples

### Starting an Import

```typescript
// In a component
const { startImport } = useImportStatus();

const handleImport = async () => {
  const success = await startImport();
  if (success) {
    toast.success('Import started!');
  }
};
```

### Monitoring Progress

```typescript
// Automatic in components using the hook
const { status, isImporting } = useImportStatus();

if (status.status === 'importing' && status.progress) {
  const percentage = (status.progress.imported / status.progress.total) * 100;
  // Show progress bar
}
```

### API Integration

```typescript
// Simple API client
async function startImport() {
  const response = await fetch('/api/import/shopify', { method: 'POST' });
  const result = await response.json();

  if (isApiSuccess(result)) {
    return result.data.importId;
  } else {
    throw new Error(result.error);
  }
}
```

## File Structure

```
src/
├── lib/
│   ├── services/
│   │   └── import-service.ts          # 🎯 Core import logic
│   └── types/
│       └── api.ts                     # 🎯 Standardized types
├── hooks/
│   └── use-import-status.ts           # 🎯 React integration
├── components/
│   └── streamlined-import-notification.tsx # 🎯 UI feedback
├── features/products/components/
│   ├── streamlined-import-button.tsx  # 🎯 Simple import trigger
│   └── streamlined-products-page-header.tsx
└── app/api/
    └── import/shopify/
        └── route.ts                   # 🎯 Simplified API
```

## Best Practices

### 1. **Use the Service Layer**

```typescript
// ✅ Good - Use ImportService
const result = await importService.startShopifyImport();

// ❌ Bad - Direct API calls from components
const response = await fetch('/api/sync/shopify/bulk');
```

### 2. **Leverage the Hook**

```typescript
// ✅ Good - Use useImportStatus hook
const { isImporting, startImport } = useImportStatus();

// ❌ Bad - Manual state management
const [isImporting, setIsImporting] = useState(false);
```

### 3. **Follow Response Patterns**

```typescript
// ✅ Good - Use helper functions
return NextResponse.json(createSuccessResponse(data));

// ❌ Bad - Manual response objects
return NextResponse.json({ success: true, data });
```

### 4. **Error Handling**

```typescript
// ✅ Good - Standardized errors
if (isApiError(response)) {
  toast.error(response.error);
}

// ❌ Bad - Inconsistent error checking
if (!response.success) {
  // Manual error handling
}
```

## Testing Strategy

### 1. **Service Testing**

```typescript
describe('ImportService', () => {
  it('should start import successfully', async () => {
    const result = await importService.startShopifyImport();
    expect(result.success).toBe(true);
  });
});
```

### 2. **Hook Testing**

```typescript
import { renderHook } from '@testing-library/react';
import { useImportStatus } from '@/hooks/use-import-status';

test('should start import', async () => {
  const { result } = renderHook(() => useImportStatus());
  await act(() => result.current.startImport());
  expect(result.current.isImporting).toBe(true);
});
```

### 3. **Component Testing**

```typescript
test('import button should be disabled when importing', () => {
  // Mock the hook
  jest.mock('@/hooks/use-import-status', () => ({
    useImportStatus: () => ({ isImporting: true })
  }))

  render(<StreamlinedImportButton />)
  expect(screen.getByRole('button')).toBeDisabled()
})
```

## Performance Optimizations

### 1. **Caching Strategy**

- In-memory status cache for 1 hour
- Automatic cache invalidation
- Efficient database queries

### 2. **Background Processing**

- Non-blocking import operations
- Progress tracking without UI blocking
- Automatic cleanup

### 3. **Minimal Re-renders**

- Optimized hook dependencies
- Memoized callback functions
- Efficient state updates

## Future Extensions

The streamlined architecture makes it easy to add new features:

1. **Multiple Platform Support**

   ```typescript
   await importService.startAmazonImport();
   await importService.startEbayImport();
   ```

2. **Scheduled Imports**

   ```typescript
   await importService.scheduleImport('daily', platform);
   ```

3. **Import Analytics**

   ```typescript
   const analytics = await importService.getImportAnalytics();
   ```

4. **Bulk Operations**
   ```typescript
   await importService.bulkOperation(['create', 'update', 'delete']);
   ```

## Conclusion

This streamlined architecture provides:

- **Better maintainability** through centralized logic
- **Improved developer experience** with simple APIs
- **Enhanced performance** through optimizations
- **Future-proof design** for easy extensions

The refactored system is easier to understand, test, and extend while providing a better user experience.
