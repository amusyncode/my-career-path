import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/signup";
  const isOnboardingPage = request.nextUrl.pathname === "/onboarding";
  const isPublicPath =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/auth/") ||
    request.nextUrl.pathname.startsWith("/api/");

  // 미로그인 사용자가 보호된 페이지에 접근 시 로그인으로 리다이렉트
  if (!user && !isAuthPage && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 로그인된 사용자가 로그인/회원가입 페이지 접근 시 role에 따라 리다이렉트
  if (user && isAuthPage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_onboarded")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    // 강사: 온보딩 미완료 시 온보딩 페이지로
    if (profile?.role === "instructor" && !profile?.is_onboarded) {
      url.pathname = "/onboarding";
    } else if (profile?.role === "super_admin" || profile?.role === "instructor") {
      url.pathname = "/admin/dashboard";
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  // 강사: 온보딩 미완료 시 온보딩 이외 페이지 접근 차단
  if (user && !isAuthPage && !isOnboardingPage && !isPublicPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_onboarded")
      .eq("id", user.id)
      .single();

    if (profile?.role === "instructor" && !profile?.is_onboarded) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  // 관리자 페이지 접근 시 role 체크
  if (user && request.nextUrl.pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin" && profile?.role !== "instructor") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
