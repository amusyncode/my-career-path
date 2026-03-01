import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateReview } from "@/lib/gemini";
import { buildResumeReviewPrompt } from "@/lib/prompts";
import { extractTextFromFile } from "@/lib/file-parser";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "application/octet-stream";

    let text: string;
    try {
      text = await extractTextFromFile(buffer, mimeType);
    } catch (error) {
      const message = error instanceof Error ? error.message : "파일 처리 중 오류가 발생했습니다.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const prompt = buildResumeReviewPrompt(text);
    const { data: result, usage } = await generateReview(prompt);

    return NextResponse.json({ ...result, usage });
  } catch (error) {
    console.error("이력서 리뷰 API 오류:", error);
    const message = error instanceof Error ? error.message : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
