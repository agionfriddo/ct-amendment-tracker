import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthenticated = !!token;

  // Check if this is an API route
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");
  // Check if this is an auth-related API route
  const isAuthRoute = request.nextUrl.pathname.startsWith("/api/auth");
  // Check if this is an admin route
  const isAdminRoute =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/api/admin");
  // Define auth paths
  const isAuthPath = request.nextUrl.pathname.startsWith("/login");

  // Protect API routes (except auth routes)
  if (isApiRoute && !isAuthRoute && !isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect to login if accessing protected route without authentication
  if (
    !isAuthenticated &&
    (isAdminRoute || request.nextUrl.pathname.startsWith("/dashboard"))
  ) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if accessing auth routes while authenticated
  if (isAuthPath && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Check admin access
  if (isAdminRoute) {
    if (!token?.isAdmin) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

// Configure the paths that should be matched by the middleware
export const config = {
  matcher: [
    // API routes
    "/api/:path*",
    // Auth routes
    "/login",
    // Protected page routes
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};
