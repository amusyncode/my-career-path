import { createClient } from "@/lib/supabase";
import type { Gem, EducationLevel, GemCategory } from "@/lib/types";

/**
 * 사용 가능한 Gem 목록 조회
 * @param category - 'resume' | 'cover_letter' | 'analysis' | 'counseling'
 * @param educationLevel - 'high_school' | 'university' (optional, 미지정시 전체)
 * @param department - 학과명 (optional, 미지정시 전체)
 */
export async function getAvailableGems(
  category: GemCategory,
  educationLevel?: EducationLevel,
  department?: string
): Promise<Gem[]> {
  const supabase = createClient();

  let query = supabase
    .from("gems")
    .select("*")
    .eq("category", category)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // education_level 필터: 해당 학교급 + 'all' 모두 반환
  if (educationLevel) {
    query = query.in("education_level", [educationLevel, "all"]);
  }

  // department 필터 (선택적)
  if (department) {
    query = query.or(`department.eq.${department},department.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Gem 목록 조회 실패:", error);
    return [];
  }

  return (data || []) as Gem[];
}

/**
 * 학생에게 최적의 Gem 자동 선택
 * 우선순위:
 * 1. education_level 일치 + department 일치 + is_default
 * 2. education_level 일치 + department=NULL + is_default
 * 3. education_level='all' + is_default
 * 4. 아무 is_default Gem
 */
export async function selectGemForStudent(
  studentId: string,
  category: GemCategory,
  overrideGemId?: string
): Promise<Gem | null> {
  const supabase = createClient();

  // 강사가 직접 gem_id를 지정한 경우
  if (overrideGemId) {
    const { data } = await supabase
      .from("gems")
      .select("*")
      .eq("id", overrideGemId)
      .eq("is_active", true)
      .single();

    return data as Gem | null;
  }

  // 학생 프로필 조회
  const { data: profile } = await supabase
    .from("profiles")
    .select("education_level, department")
    .eq("id", studentId)
    .single();

  const eduLevel = profile?.education_level || "high_school";
  const dept = profile?.department || null;

  // 모든 default Gem 후보 조회 (해당 카테고리)
  const { data: gems } = await supabase
    .from("gems")
    .select("*")
    .eq("category", category)
    .eq("is_active", true)
    .eq("is_default", true)
    .order("sort_order", { ascending: true });

  if (!gems || gems.length === 0) return null;

  const candidates = gems as Gem[];

  // 1순위: education_level 일치 + department 일치
  if (dept) {
    const match1 = candidates.find(
      (g) => g.education_level === eduLevel && g.department === dept
    );
    if (match1) return match1;
  }

  // 2순위: education_level 일치 + department=NULL (해당 학교급 범용)
  const match2 = candidates.find(
    (g) => g.education_level === eduLevel && g.department === null
  );
  if (match2) return match2;

  // 3순위: education_level='all' + department 일치
  if (dept) {
    const match3 = candidates.find(
      (g) => g.education_level === "all" && g.department === dept
    );
    if (match3) return match3;
  }

  // 4순위: education_level='all' + department=NULL (완전 범용)
  const match4 = candidates.find(
    (g) => g.education_level === "all" && g.department === null
  );
  if (match4) return match4;

  // 최후: 아무 default Gem
  return candidates[0] || null;
}

/**
 * Gem 사용 횟수 증가
 */
export async function incrementGemUsage(gemId: string): Promise<void> {
  const supabase = createClient();

  // Try RPC first, fallback to manual increment
  const { error: rpcError } = await supabase.rpc("increment_gem_usage", {
    gem_id: gemId,
  });

  if (rpcError) {
    // Fallback: manual increment
    const { data: gem } = await supabase
      .from("gems")
      .select("usage_count")
      .eq("id", gemId)
      .single();

    if (gem) {
      await supabase
        .from("gems")
        .update({ usage_count: (gem.usage_count || 0) + 1 })
        .eq("id", gemId);
    }
  }
}

/**
 * 교육수준별 Gem 카운트 조회
 */
export async function getGemCounts(): Promise<{
  high_school: number;
  university: number;
  all: number;
  total: number;
}> {
  const supabase = createClient();

  const { data } = await supabase
    .from("gems")
    .select("education_level")
    .eq("is_active", true);

  const gems = data || [];
  return {
    high_school: gems.filter((g) => g.education_level === "high_school").length,
    university: gems.filter((g) => g.education_level === "university").length,
    all: gems.filter((g) => g.education_level === "all").length,
    total: gems.length,
  };
}
