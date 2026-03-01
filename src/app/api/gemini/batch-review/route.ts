import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateReview } from "@/lib/gemini";
import { buildResumeReviewPrompt, buildCoverLetterReviewPrompt } from "@/lib/prompts";
import { extractTextFromFile } from "@/lib/file-parser";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // 관리자 권한 확인
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const body = await request.json();
    const { document_id, document_type, user_id } = body;

    if (!document_id || !document_type || !user_id) {
      return NextResponse.json(
        { error: "document_id, document_type, user_id가 필요합니다." },
        { status: 400 }
      );
    }

    if (!["resume", "cover_letter"].includes(document_type)) {
      return NextResponse.json(
        { error: "document_type은 'resume' 또는 'cover_letter'이어야 합니다." },
        { status: 400 }
      );
    }

    const tableName = document_type === "resume" ? "uploaded_resumes" : "uploaded_cover_letters";

    // 문서 조회
    const { data: doc, error: docError } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
    }

    // 상태를 reviewing으로 업데이트
    await supabase
      .from(tableName)
      .update({ status: "reviewing" })
      .eq("id", document_id);

    try {
      // Supabase Storage에서 파일 다운로드
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(doc.file_url);

      if (downloadError || !fileData) {
        throw new Error("파일 다운로드에 실패했습니다.");
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = doc.file_type || "application/octet-stream";

      // 텍스트 추출
      const text = await extractTextFromFile(buffer, mimeType);

      // 프롬프트 생성 및 AI 리뷰
      const prompt = document_type === "resume"
        ? buildResumeReviewPrompt(text)
        : buildCoverLetterReviewPrompt(text);

      const { data: result, usage } = await generateReview(prompt);

      // ai_review_results에 저장
      await supabase.from("ai_review_results").insert({
        user_id: user_id,
        document_type: document_type,
        document_id: document_id,
        overall_score: (result as Record<string, unknown>).overall_score ?? null,
        improvement_points: (result as Record<string, unknown>).improvement_points ?? [],
        reviewer_comment: (result as Record<string, unknown>).reviewer_comment ?? null,
        input_tokens: usage?.promptTokenCount ?? 0,
        output_tokens: usage?.candidatesTokenCount ?? 0,
        model_name: "gemini-2.5-flash",
      });

      // 문서 상태를 reviewed로 업데이트
      await supabase
        .from(tableName)
        .update({ status: "reviewed" })
        .eq("id", document_id);

      return NextResponse.json({
        success: true,
        document_id,
        overall_score: (result as Record<string, unknown>).overall_score ?? null,
        usage,
      });
    } catch (processError) {
      // 실패 시 문서 상태를 failed로 업데이트
      await supabase
        .from(tableName)
        .update({ status: "failed" })
        .eq("id", document_id);

      throw processError;
    }
  } catch (error) {
    console.error("일괄 첨삭 API 오류:", error);
    const message = error instanceof Error ? error.message : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
