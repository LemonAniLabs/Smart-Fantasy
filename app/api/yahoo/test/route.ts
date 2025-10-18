import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

/**
 * Test endpoint to verify Yahoo API connection
 * GET /api/yahoo/test
 *
 * NOTE: Yahoo Fantasy API does NOT support client_credentials (2-legged OAuth).
 * Only authorization_code flow (3-legged OAuth) is supported, which requires user login.
 *
 * To access Yahoo Fantasy data:
 * 1. User must sign in with Yahoo account via /api/auth/signin/yahoo
 * 2. User grants permission to access their fantasy data
 * 3. Use the access token from the session to make API requests
 */
export async function GET() {
  try {
    const session = await getServerSession()

    if (!session || !session.accessToken) {
      return NextResponse.json({
        success: false,
        message: 'Yahoo API requires user authentication',
        info: {
          note: 'Yahoo Fantasy API does NOT support 2-legged OAuth (client credentials)',
          requirement: 'Users must sign in with their Yahoo account to access Fantasy data',
          signInUrl: '/api/auth/signin/yahoo',
          architecture: 'Only 3-legged OAuth (authorization code flow) is supported',
        },
      }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      message: 'Yahoo API connection successful',
      data: {
        authenticated: true,
        user: session.user?.email,
        tokenPresent: !!session.accessToken,
      },
    })
  } catch (error: unknown) {
    console.error('Yahoo API test failed:', error)
    const err = error as { response?: { data?: unknown }; message?: string }
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Unknown error',
        details: err.response?.data || null,
      },
      { status: 500 }
    )
  }
}
