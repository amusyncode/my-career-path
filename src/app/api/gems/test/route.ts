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

    // 강사 권한 확인
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, gemini_api_key")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
      return NextResponse.json({ error: "강사 권한이 필요합니다." }, { status: 403 });
    }

    if (!profile.gemini_api_key) {
      return NextResponse.json({
        success: false,
        error: "API 키가 설정되지 않았습니다.",
      });
    }

    const { system_prompt, test_text } = await request.json();

    if (!system_prompt || !test_text) {
      return NextResponse.json(
        { error: "system_prompt와 test_text가 필요합니다." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(profile.gemini_api_key);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: system_prompt,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: test_text }] }],
      generationConfig: { maxOutputTokens: 2000 },
    });

    const text = result.response.text();

    // JSON 파싱 시도
    let parsed = null;
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const cleaned = match ? match[1].trim() : text.trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // JSON이 아니면 raw text 반환
    }

    return NextResponse.json({
      success: true,
      result: parsed || text,
      raw: text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({
      success: false,
      error: message,
    });
  }
}
