import { NextResponse } from "next/server";
import { withSuperAdminAuth } from "@/lib/super-admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { generateInviteCodeSync } from "@/lib/invite";

export async function POST(request: Request) {
  const { error: authError } = await withSuperAdminAuth();
  if (authError) return authError;

  try {
    const { email, password, name, school, phone } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "이메일, 비밀번호, 이름은 필수입니다" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상이어야 합니다" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Create user via Admin API
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: "instructor" },
      });

    if (createError) {
      if (createError.message.includes("already")) {
        return NextResponse.json(
          { error: "이미 등록된 이메일입니다" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    if (!newUser.user) {
      return NextResponse.json(
        { error: "사용자 생성 실패" },
        { status: 500 }
      );
    }

    const inviteCode = generateInviteCodeSync();

    // Update profile (trigger creates basic profile)
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        role: "instructor",
        name,
        school: school || null,
        phone: phone || null,
        invite_code: inviteCode,
        is_active: true,
        is_onboarded: true,
      })
      .eq("id", newUser.user.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
    }

    return NextResponse.json({
      success: true,
      instructor: {
        id: newUser.user.id,
        email: newUser.user.email,
        name,
        invite_code: inviteCode,
      },
    });
  } catch (err) {
    console.error("Create instructor error:", err);
    return NextResponse.json(
      { error: "강사 계정 생성 실패" },
      { status: 500 }
    );
  }
}
