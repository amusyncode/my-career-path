import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, name")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin" && profile?.role !== "instructor") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const body = await request.json();
    const { to, subject, html, content_type, student_id, document_id } = body;

    if (!to || !subject || !html || !content_type || !student_id) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    // TODO: Integrate with Resend or other email service
    // For now, just log the email
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({ from: 'noreply@mycareerpath.com', to, subject, html });

    const { data: emailLog, error: logError } = await supabase
      .from("email_logs")
      .insert({
        instructor_id: user.id,
        student_id,
        recipient_email: to,
        subject,
        content_type,
        document_id: document_id || null,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (logError) {
      console.error("Email log error:", logError);
      return NextResponse.json({ error: "이메일 로그 저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, email_log_id: emailLog?.id });
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json(
      { error: "이메일 발송에 실패했습니다." },
      { status: 500 }
    );
  }
}
