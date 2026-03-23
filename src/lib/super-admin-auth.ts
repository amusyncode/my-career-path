import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function withSuperAdminAuth() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      ),
      supabase: null,
      userId: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    return {
      error: NextResponse.json(
        { error: "관리자 권한이 필요합니다" },
        { status: 403 }
      ),
      supabase: null,
      userId: null,
    };
  }

  return { error: null, supabase, userId: user.id };
}
