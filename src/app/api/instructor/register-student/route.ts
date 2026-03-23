import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    // Instructor/Admin check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin" && profile?.role !== "instructor") {
      return NextResponse.json(
        { error: "강사 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      school,
      department,
      grade,
      target_field,
      student_email,
      phone,
      education_level,
    } = body;

    // Validate required fields
    if (!name || !school || !department || !grade || !education_level) {
      return NextResponse.json(
        { error: "이름, 학교, 학과, 학년, 학교급은 필수입니다." },
        { status: 400 }
      );
    }

    // Check for duplicate (same name + school + department under this instructor)
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("instructor_id", user.id)
      .eq("name", name)
      .eq("school", school)
      .eq("department", department)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "이미 등록된 학생입니다." },
        { status: 409 }
      );
    }

    // Create student profile (without auth account)
    const { data: newStudent, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: crypto.randomUUID(),
        name,
        school,
        department,
        grade: parseInt(grade),
        target_field: target_field || null,
        student_email: student_email || null,
        phone: phone || null,
        education_level,
        role: "student",
        instructor_id: user.id,
        is_active: true,
        is_onboarded: false,
        is_public: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("학생 등록 실패:", insertError);
      return NextResponse.json(
        { error: "학생 등록에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "학생이 등록되었습니다.",
      data: newStudent,
    });
  } catch (error) {
    console.error("학생 등록 API 오류:", error);
    const message =
      error instanceof Error
        ? error.message
        : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
