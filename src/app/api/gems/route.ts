import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { GemCategory, EducationLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as GemCategory | null;
    const educationLevel = searchParams.get("educationLevel") as EducationLevel | null;
    const department = searchParams.get("department");

    let query = supabase
      .from("gems")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }

    if (educationLevel) {
      query = query.in("education_level", [educationLevel, "all"]);
    }

    if (department) {
      query = query.or(`department.eq.${department},department.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Gem 목록 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Gems API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
