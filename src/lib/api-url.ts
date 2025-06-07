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
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path

  // On the client side, we can use relative URLs
  if (typeof window !== 'undefined') {
    return `/${cleanPath}`
  }

  // On the server side, we need to construct the absolute URL
  const baseUrl = 
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

  return `${baseUrl}/${cleanPath}`
}

/**
 * Enhanced fetch wrapper that automatically handles URL resolution
 * @param path - The API path
 * @param options - Fetch options
 * @returns Promise with the fetch response
 */
export async function apiRequest(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path)
  return fetch(url, options)
}