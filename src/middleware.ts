import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

const STUDENT_PREFIXES = ["/dashboard", "/levels", "/chapters", "/lessons", "/tests", "/attempts", "/progress", "/words"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (role !== "ADMIN" && role !== "STAFF") {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
    }
  }
  if (STUDENT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (role !== "STUDENT") return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
