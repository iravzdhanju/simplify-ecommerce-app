/**
 * Standardized API Response Types
 * Used across all API routes for consistent error handling and responses
 */

export interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
    message?: string
    details?: unknown
}

export interface ApiError {
    code: string
    message: string
    details?: unknown
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
}

/**
 * Standard error codes for consistent error handling
 */
export enum ApiErrorCode {
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    NOT_FOUND = 'NOT_FOUND',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    CONFLICT = 'CONFLICT',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    RATE_LIMITED = 'RATE_LIMITED',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
    return {
        success: true,
        data,
        message
    }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(error: string, code?: ApiErrorCode): ApiResponse {
    return {
        success: false,
        error,
        ...(code && { code })
    }
}

/**
 * Authentication error helper
 */
export function createAuthError(): ApiResponse {
    return createErrorResponse('Unauthorized', ApiErrorCode.UNAUTHORIZED)
}

/**
 * Validation error helper
 */
export function createValidationError(details: unknown): ApiResponse {
    return {
        success: false,
        error: 'Validation error',
        details
    }
}

/**
 * Type guard for API responses
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true; data: T } {
    return response.success === true && response.data !== undefined
}

/**
 * Type guard for API errors
 */
export function isApiError(response: ApiResponse): response is ApiResponse & { success: false; error: string } {
    return response.success === false && response.error !== undefined
} 