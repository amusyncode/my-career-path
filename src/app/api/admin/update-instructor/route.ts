import { NextResponse } from "next/server";
import { withSuperAdminAuth } from "@/lib/super-admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export async function PUT(request: Request) {
  const { error: authError } = await withSuperAdminAuth();
  if (authError) return authError;

  try {
    const { instructorId, updates } = await request.json();

    if (!instructorId) {
      return NextResponse.json(
        { error: "강사 ID는 필수입니다" },
        { status: 400 }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "수정할 내용이 없습니다" },
        { status: 400 }
      );
    }

    // Only allow specific fields
    const allowedFields = ["name", "school", "phone", "is_active"];
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

    const { data, error: updateError } = await adminClient
      .from("profiles")
      .update(sanitized)
      .eq("id", instructorId)
      .eq("role", "instructor")
      .select()
      .single();

    if (updateError) {
      console.error("Update instructor error:", updateError);
      return NextResponse.json(
        { error: "강사 정보 수정 실패" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "해당 강사를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      instructor: data,
    });
  } catch (err) {
    console.error("Update instructor error:", err);
    return NextResponse.json(
      { error: "강사 정보 수정 실패" },
      { status: 500 }
    );
  }
}
