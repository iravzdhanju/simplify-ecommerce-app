/**
 * API URL Utility
 * Handles absolute URL construction for both client and server-side fetch calls
 */

/**
 * Constructs an absolute URL for API calls
 * @param path - The API path (e.g., '/api/products')
 * @returns Absolute URL for the API call
 */
export function getApiUrl(path: string): string {
  // Ensure path starts with slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`

  // On client side, use relative URLs
  if (typeof window !== 'undefined') {
    return cleanPath
  }

  // On server side, always use absolute URLs to avoid URL parsing issues
  const baseUrl = getBaseUrl()
  return `${baseUrl}${cleanPath}`
}

/**
 * Get the base URL for the application
 */
function getBaseUrl(): string {
  // Client side - use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  // Server side - try various environment variables
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '') // Remove trailing slash
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // Development fallback
  return 'http://localhost:3000'
}

/**
 * Enhanced fetch wrapper that automatically handles URL resolution
 * @param path - The API path
 * @param options - Fetch options
 * @returns Promise with the fetch response
 */
export async function apiRequest(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path)

  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[apiRequest] ${path} -> ${url}`)
  }

  return fetch(url, options)
}