import { NextResponse } from "next/server";
import { withSuperAdminAuth } from "@/lib/super-admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const { error: authError } = await withSuperAdminAuth();
  if (authError) return authError;

  try {
    const { instructorId, newPassword } = await request.json();

    if (!instructorId || !newPassword) {
      return NextResponse.json(
        { error: "강사 ID와 새 비밀번호는 필수입니다" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상이어야 합니다" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Verify the user is an instructor
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", instructorId)
      .single();

    if (!profile || profile.role !== "instructor") {
      return NextResponse.json(
        { error: "해당 강사를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const { error: resetError } =
      await adminClient.auth.admin.updateUserById(instructorId, {
        password: newPassword,
      });

    if (resetError) {
      console.error("Password reset error:", resetError);
      return NextResponse.json(
        { error: "비밀번호 재설정 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "비밀번호가 재설정되었습니다",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json(
      { error: "비밀번호 재설정 실패" },
      { status: 500 }
    );
  }
}
