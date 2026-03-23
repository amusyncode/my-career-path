import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
      return NextResponse.json({ error: "강사 권한이 필요합니다." }, { status: 403 });
    }

    const { apiKey } = await request.json();

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
      return NextResponse.json(
        { error: "올바른 API 키를 입력해주세요." },
        { status: 400 }
      );
    }

    // Gemini 유효성 테스트
    try {
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "test" }] }],
        generationConfig: { maxOutputTokens: 5 },
      });
    } catch {
      return NextResponse.json(
        { error: "올바르지 않은 API 키입니다. 확인 후 다시 시도해주세요." },
        { status: 400 }
      );
    }

    // 저장
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ gemini_api_key: apiKey.trim() })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "API 키 저장에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "API 키가 저장되었습니다.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
