import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateReview } from "@/lib/gemini";
import { buildStudentAnalysisPrompt } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // 관리자 권한 확인
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id가 필요합니다." }, { status: 400 });
    }

    // 학생 데이터 조회
    const [profileRes, goalsRes, skillsRes, projectsRes, certsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user_id).single(),
      supabase.from("roadmap_goals").select("title, category, status").eq("user_id", user_id),
      supabase.from("skills").select("name, level, category").eq("user_id", user_id),
      supabase.from("projects").select("title, tech_stack, status").eq("user_id", user_id),
      supabase.from("certificates").select("name, type, issuer").eq("user_id", user_id),
    ]);

    if (!profileRes.data) {
      return NextResponse.json({ error: "학생 프로필을 찾을 수 없습니다." }, { status: 404 });
    }

    const prompt = buildStudentAnalysisPrompt({
      name: profileRes.data.name,
      school: profileRes.data.school,
      department: profileRes.data.department,
      grade: profileRes.data.grade,
      target_field: profileRes.data.target_field,
      target_company: profileRes.data.target_company,
      bio: profileRes.data.bio,
      goals: goalsRes.data || [],
      skills: skillsRes.data || [],
      projects: projectsRes.data || [],
      certificates: certsRes.data || [],
    });

    const result = await generateReview(prompt);

    return NextResponse.json(result);
  } catch (error) {
    console.error("학생 분석 API 오류:", error);
    const message = error instanceof Error ? error.message : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
