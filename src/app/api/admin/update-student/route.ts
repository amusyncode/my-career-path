import { NextResponse } from "next/server";
import { withSuperAdminAuth } from "@/lib/super-admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export async function PUT(request: Request) {
  const { error: authError } = await withSuperAdminAuth();
  if (authError) return authError;

  try {
    const { studentId, updates } = await request.json();

    if (!studentId) {
      return NextResponse.json(
        { error: "학생 ID는 필수입니다" },
        { status: 400 }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "수정할 내용이 없습니다" },
        { status: 400 }
      );
    }

    const allowedFields = [
      "name",
      "school",
      "department",
      "grade",
      "education_level",
      "instructor_id",
      "target_field",
    ];
    const sanitized: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json(
        { error: "허용된 수정 항목이 없습니다" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Check student exists
    const { data: student } = await adminClient
      .from("profiles")
      .select("role, instructor_id")
      .eq("id", studentId)
      .single();

    if (!student || student.role !== "student") {
      return NextResponse.json(
        { error: "해당 학생을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // Update profile
    const { data, error: updateError } = await adminClient
      .from("profiles")
      .update(sanitized)
      .eq("id", studentId)
      .select()
      .single();

    if (updateError) {
      console.error("Update student profile error:", updateError);
      return NextResponse.json(
        { error: "학생 정보 수정 실패" },
        { status: 500 }
      );
    }

    // If instructor_id changed, update related tables
    if (
      "instructor_id" in sanitized &&
      sanitized.instructor_id !== student.instructor_id
    ) {
      const newInstructorId = sanitized.instructor_id;
      const relatedTables = [
        "uploaded_resumes",
        "uploaded_cover_letters",
        "ai_review_results",
        "counseling_records",
        "resume_data",
        "cover_letter_data",
      ];

      for (const table of relatedTables) {
        const { error: relError } = await adminClient
          .from(table)
          .update({ instructor_id: newInstructorId })
          .eq("user_id", studentId);

        if (relError) {
          console.error(`Update ${table} instructor_id error:`, relError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      student: data,
    });
  } catch (err) {
    console.error("Update student error:", err);
    return NextResponse.json(
      { error: "학생 정보 수정 실패" },
      { status: 500 }
    );
  }
}
