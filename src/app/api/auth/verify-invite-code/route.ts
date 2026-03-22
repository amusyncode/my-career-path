import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invite_code } = body;

    if (!invite_code || typeof invite_code !== "string") {
      return NextResponse.json({ valid: false });
    }

    const supabase = createServerSupabaseClient();

    // RLS를 우회하기 위해 DB function 사용 시도, fallback으로 직접 조회
    const { data, error } = await supabase.rpc("verify_invite_code", {
      p_code: invite_code,
    });

    if (!error && data && data.length > 0 && data[0].valid) {
      return NextResponse.json({
        valid: true,
        instructorName: data[0].instructor_name,
        instructorId: data[0].instructor_id,
      });
    }

    // RPC 실패 시 직접 조회 (RLS가 허용하는 경우)
    if (error) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("invite_code", invite_code)
        .eq("role", "instructor")
        .eq("is_active", true)
        .single();

      if (profile) {
        return NextResponse.json({
          valid: true,
          instructorName: profile.name,
          instructorId: profile.id,
        });
      }
    }

    return NextResponse.json({ valid: false });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
