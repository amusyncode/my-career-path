import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // API 키 조회
    const { data: profile } = await supabase
      .from("profiles")
      .select("gemini_api_key")
      .eq("id", user.id)
      .single();

    if (!profile?.gemini_api_key) {
      return NextResponse.json({
        success: false,
        error: "API 키 미설정",
      });
    }

    // Gemini 테스트 호출
    const genAI = new GoogleGenerativeAI(profile.gemini_api_key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "연결 테스트입니다. '연결 성공'이라고만 답해주세요." }] }],
      generationConfig: { maxOutputTokens: 20 },
    });

    const text = result.response.text();

    return NextResponse.json({
      success: true,
      model: "gemini-2.5-flash",
      response: text.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({
      success: false,
      error: message,
    });
  }
}
