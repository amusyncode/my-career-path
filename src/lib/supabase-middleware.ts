import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 공개 경로 (인증 불필요)
const PUBLIC_PATHS = ["/", "/login", "/signup"];
const PUBLIC_PREFIXES = ["/auth/", "/api/", "/public/"];

// 학생 접근 가능 경로
const STUDENT_PATHS = [
  "/dashboard",
  "/roadmap",
  "/daily",
  "/portfolio",
  "/certificates",
  "/resume",
  "/analytics",
  "/profile",
];

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

  const pathname = request.nextUrl.pathname;

  // 정적 파일, API 라우트는 통과
  if (
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    // API 라우트는 내부에서 권한 체크하므로 세션만 갱신
    await supabase.auth.getUser();
    return supabaseResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isPublicPage = PUBLIC_PATHS.includes(pathname);
  const isOnboardingPage = pathname === "/onboarding";

  // === 미로그인 ===
  if (!user) {
    // 공개 페이지: 통과
    if (isPublicPage || isAuthPage) {
      return supabaseResponse;
    }
    // 보호된 페이지: 로그인으로 리다이렉트
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // === 로그인된 유저: profiles 1회 조회 ===
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_onboarded")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "student";
  const isOnboarded = profile?.is_onboarded !== false;

  // 로그인 상태에서 로그인/회원가입 접근 → 역할별 대시보드로 리다이렉트
  if (isAuthPage) {
    const url = request.nextUrl.clone();
    if (role === "instructor" && !isOnboarded) {
      url.pathname = "/onboarding";
    } else if (role === "instructor") {
      url.pathname = "/admin/dashboard";
    } else if (role === "super_admin") {
      url.pathname = "/admin/dashboard";
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  // 강사: 온보딩 미완료 → 온보딩 페이지만 허용
  if (role === "instructor" && !isOnboarded && !isOnboardingPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  // 온보딩 페이지: 온보딩 완료된 유저는 접근 불가
  if (isOnboardingPage && (isOnboarded || role === "student")) {
    const url = request.nextUrl.clone();
    url.pathname = role === "student" ? "/dashboard" : "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  // === /admin/* 라우트 보호 ===
  if (pathname.startsWith("/admin")) {
    if (role === "student") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    if (role !== "super_admin" && role !== "instructor") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    // instructor, super_admin → 통과
    return supabaseResponse;
  }

  // === /instructor/* 라우트 보호 (추후 사용) ===
  if (pathname.startsWith("/instructor")) {
    if (role === "student") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    // instructor, super_admin → 통과
    return supabaseResponse;
  }

  // === 학생 라우트 (/dashboard, /roadmap 등) ===
  // 모든 역할 접근 가능 (student, instructor, super_admin)
  const isStudentPath = STUDENT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isStudentPath) {
    return supabaseResponse;
  }

  // === 루트 경로 ===
  if (pathname === "/") {
    return supabaseResponse;
  }

  // 기타 경로: 통과
  return supabaseResponse;
}
