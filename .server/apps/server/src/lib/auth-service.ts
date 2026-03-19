import { z } from 'zod'

// Define the user type using functional approach
export type User = Readonly<{
  id: string
  email: string
  role: string
}>

// Pure function to validate token format
export const isValidTokenFormat = (token: string): boolean => 
  typeof token === 'string' && token.trim().length > 0

// Pure function to extract token from authorization header
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader) return null
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.replace('Bearer ', '').trim()
}

// Database interface for token verification
export interface TokenVerifier {
  verifyToken: (token: string) => Promise<User | null>
}

// Mock implementation of TokenVerifier
export const createMockTokenVerifier = (): TokenVerifier => ({
  verifyToken: async (token: string): Promise<User | null> => {
    // In a real application, this would verify against a database
    // For now, we'll just return a mock user if the token exists
    if (isValidTokenFormat(token)) {
      return {
        id: '1',
        email: 'user@example.com',
        role: 'admin',
      }
    }
    return null
  }
})

// Schema for request with authorization header
export const authHeaderSchema = z.object({
  headers: z.object({
    authorization: z.string().optional(),
  }).optional(),
})

// Type for authentication result
export type AuthResult = 
  | { success: true; user: User }
  | { success: false; error: string }

// Pure function to authenticate a request
export const authenticateRequest = async (
  tokenVerifier: TokenVerifier,
  headers?: { authorization?: string }
): Promise<AuthResult> => {
  const authHeader = headers?.authorization
  const token = extractTokenFromHeader(authHeader)
  
  if (!token) {
    return { 
      success: false, 
      error: 'Unauthorized: No valid authorization header provided' 
    }
  }
  
  const user = await tokenVerifier.verifyToken(token)
  
  if (!user) {
    return { 
      success: false, 
      error: 'Unauthorized: Invalid token' 
    }
  }
  
  return { success: true, user }
}
