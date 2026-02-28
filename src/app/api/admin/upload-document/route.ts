import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
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

    // Admin check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const studentId = formData.get("student_id") as string | null;
    const documentType = formData.get("document_type") as string | null;
    const title = formData.get("title") as string | null;

    if (!file || !studentId || !documentType) {
      return NextResponse.json(
        { error: "file, student_id, document_type은 필수입니다." },
        { status: 400 }
      );
    }

    if (!["resume", "cover_letter"].includes(documentType)) {
      return NextResponse.json(
        { error: "document_type은 resume 또는 cover_letter이어야 합니다." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "파일 크기는 10MB를 초과할 수 없습니다." },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "pdf";
    const storagePath = `${studentId}/${Date.now()}_${file.name}`;
    const bucket =
      documentType === "resume" ? "resumes" : "cover-letters";

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage 업로드 실패:", uploadError);
      return NextResponse.json(
        { error: "파일 업로드에 실패했습니다." },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    // Insert DB record
    const table =
      documentType === "resume"
        ? "uploaded_resumes"
        : "uploaded_cover_letters";

    const { data: record, error: dbError } = await supabase
      .from(table)
      .insert({
        user_id: studentId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        title: title || file.name.replace(/\.[^.]+$/, ""),
        status: "uploaded",
        file_type: ext.toUpperCase(),
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB 기록 실패:", dbError);
      return NextResponse.json(
        { error: "파일 정보 저장에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "업로드 완료",
      data: record,
    });
  } catch (error) {
    console.error("관리자 업로드 API 오류:", error);
    const message =
      error instanceof Error
        ? error.message
        : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
