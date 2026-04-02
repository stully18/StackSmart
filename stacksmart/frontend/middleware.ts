import { type NextRequest, NextResponse } from 'next/server'

// Auth is now handled client-side in AuthContext and page components
// This middleware was checking for cookies that Supabase v2 doesn't use
// Supabase v2 stores auth in localStorage on the client, not server cookies
// Disabling middleware-based auth checks to avoid conflicts

export async function middleware(request: NextRequest) {
  // All auth checks are now handled client-side in:
  // - AuthContext (initializes auth state)
  // - Individual page components (redirect if not authenticated)
  // This prevents double-redirects and race conditions
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Apply to all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
