import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";
import { NextResponse } from "next/server";

// 캐시용 WeakMap (같은 요청 내 중복 조회 방지)
const profileCache = new WeakMap<object, Profile | null>();

/**
 * 현재 로그인 유저의 전체 profiles 데이터 반환
 */
export async function getUserProfile(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<Profile | null> {
  // 캐시 체크
  if (profileCache.has(supabase)) {
    return profileCache.get(supabase) || null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    profileCache.set(supabase, null);
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const result = (profile as Profile) || null;
  profileCache.set(supabase, result);
  return result;
}

/**
 * 현재 유저의 role만 반환
 */
export async function getUserRole(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<"super_admin" | "instructor" | "student" | null> {
  const profile = await getUserProfile(supabase);
  return profile?.role || null;
}

/**
 * instructor 또는 super_admin 여부
 */
export async function isInstructor(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<boolean> {
  const role = await getUserRole(supabase);
  return role === "instructor" || role === "super_admin";
}

/**
 * super_admin 여부
 */
export async function isSuperAdmin(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<boolean> {
  const role = await getUserRole(supabase);
  return role === "super_admin";
}

/**
 * API 라우트용: instructor/super_admin 권한 필수
 */
export async function requireInstructor(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<
  | { profile: Profile; error?: never }
  | { profile?: never; error: { message: string; status: number } }
> {
  const profile = await getUserProfile(supabase);

  if (!profile) {
    return { error: { message: "로그인이 필요합니다", status: 401 } };
  }

  if (profile.role !== "instructor" && profile.role !== "super_admin") {
    return { error: { message: "강사 권한이 필요합니다", status: 403 } };
  }

  return { profile };
}

/**
 * API 라우트용: 로그인만 확인 (역할 무관)
 */
export async function requireAuth(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<
  | { profile: Profile; error?: never }
  | { profile?: never; error: { message: string; status: number } }
> {
  const profile = await getUserProfile(supabase);

  if (!profile) {
    return { error: { message: "로그인이 필요합니다", status: 401 } };
  }

  return { profile };
}

/**
 * API 라우트용: super_admin만 통과
 */
export async function requireSuperAdmin(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<
  | { profile: Profile; error?: never }
  | { profile?: never; error: { message: string; status: number } }
> {
  const profile = await getUserProfile(supabase);

  if (!profile) {
    return { error: { message: "로그인이 필요합니다", status: 401 } };
  }

  if (profile.role !== "super_admin") {
    return { error: { message: "최고 관리자 권한이 필요합니다", status: 403 } };
  }

  return { profile };
}

/**
 * 해당 studentId가 현재 유저의 소속 학생인지 확인
 */
export async function isMyStudent(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  studentId: string
): Promise<boolean> {
  const profile = await getUserProfile(supabase);
  if (!profile) return false;

  // super_admin은 모든 학생 접근 가능
  if (profile.role === "super_admin") return true;

  // instructor: 해당 학생의 instructor_id가 본인인지 확인
  if (profile.role === "instructor") {
    const { data: student } = await supabase
      .from("profiles")
      .select("instructor_id")
      .eq("id", studentId)
      .single();

    return student?.instructor_id === profile.id;
  }

  return false;
}

// ============================================
// API 라우트 래퍼 함수
// ============================================

/**
 * instructor/super_admin 권한 래퍼
 */
export function withInstructorAuth(
  handler: (request: Request, profile: Profile) => Promise<Response>
) {
  return async (request: Request) => {
    const supabase = createServerSupabaseClient();
    const result = await requireInstructor(supabase);

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.status }
      );
    }

    return handler(request, result.profile);
  };
}

/**
 * 로그인 필수 래퍼 (모든 역할)
 */
export function withAuth(
  handler: (request: Request, profile: Profile) => Promise<Response>
) {
  return async (request: Request) => {
    const supabase = createServerSupabaseClient();
    const result = await requireAuth(supabase);

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.status }
      );
    }

    return handler(request, result.profile);
  };
}

/**
 * super_admin 전용 래퍼
 */
export function withSuperAdminAuth(
  handler: (request: Request, profile: Profile) => Promise<Response>
) {
  return async (request: Request) => {
    const supabase = createServerSupabaseClient();
    const result = await requireSuperAdmin(supabase);

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.status }
      );
    }

    return handler(request, result.profile);
  };
}
