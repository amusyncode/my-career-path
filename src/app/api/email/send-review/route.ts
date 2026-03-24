import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { resend, EMAIL_FROM } from "@/lib/resend";

function buildEmailHtml(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <tr>
          <td style="background:linear-gradient(135deg,#3B82F6,#2563EB);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">MyCareerPath</h1>
            <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">${title}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;background-color:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">이 이메일은 MyCareerPath에서 발송되었습니다.</p>
            <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">본 메일은 발신 전용이며, 회신되지 않습니다.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

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

    const { reviewId, studentId } = await request.json();

    if (!reviewId || !studentId) {
      return NextResponse.json(
        { error: "reviewId와 studentId는 필수입니다." },
        { status: 400 }
      );
    }

    // Fetch student profile
    const { data: student, error: studentError } = await supabase
      .from("profiles")
      .select("name, student_email, email")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: "학생 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const recipientEmail = student.student_email || student.email;
    if (!recipientEmail) {
      return NextResponse.json({ error: "학생 이메일이 등록되어 있지 않습니다." }, { status: 400 });
    }

    // Fetch review data
    const { data: review, error: reviewError } = await supabase
      .from("ai_reviews")
      .select("*")
      .eq("id", reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: "리뷰 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const reviewResult = typeof review.result === "string"
      ? JSON.parse(review.result)
      : review.result;

    // Build score section
    const overallScore = reviewResult?.overall_score ?? reviewResult?.score ?? "-";
    const feedback = reviewResult?.feedback ?? reviewResult?.summary ?? "피드백 없음";
    const improvements = reviewResult?.improvements ?? reviewResult?.improvement_points ?? [];

    let improvementHtml = "";
    if (Array.isArray(improvements) && improvements.length > 0) {
      improvementHtml = `
        <div style="margin-top:24px;">
          <h3 style="margin:0 0 12px;color:#1e40af;font-size:16px;font-weight:600;">개선 포인트</h3>
          <ul style="margin:0;padding-left:20px;color:#374151;line-height:1.8;">
            ${improvements.map((item: string) => `<li>${item}</li>`).join("")}
          </ul>
        </div>`;
    }

    const subject = `[MyCareerPath] AI 분석 결과 - ${student.name}님`;
    const emailBody = `
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">안녕하세요, <strong>${student.name}</strong>님!</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
        담당 선생님(${profile?.name || "선생님"})이 AI 분석 결과를 공유합니다.
      </p>

      <div style="background-color:#eff6ff;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">종합 점수</p>
        <p style="margin:0;color:#1e40af;font-size:42px;font-weight:700;">${overallScore}<span style="font-size:18px;color:#6b7280;">/100</span></p>
      </div>

      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px;color:#1e40af;font-size:16px;font-weight:600;">종합 피드백</h3>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;background-color:#f9fafb;padding:16px;border-radius:8px;border-left:4px solid #3B82F6;">
          ${feedback}
        </p>
      </div>

      ${improvementHtml}

      <div style="margin-top:32px;text-align:center;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://my-career-path-seven.vercel.app"}/dashboard"
           style="display:inline-block;padding:12px 32px;background-color:#3B82F6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
          MyCareerPath에서 자세히 보기
        </a>
      </div>
    `;

    const html = buildEmailHtml("AI 분석 결과 안내", emailBody);

    // Send email via Resend
    const { error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject,
      html,
    });

    const status = sendError ? "failed" : "sent";

    // Log to email_logs
    await supabase.from("email_logs").insert({
      instructor_id: user.id,
      student_id: studentId,
      recipient_email: recipientEmail,
      subject,
      content_type: "ai_review",
      status,
      sent_at: new Date().toISOString(),
      error_message: sendError?.message || null,
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return NextResponse.json({ error: "이메일 발송에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, recipientEmail });
  } catch (error) {
    console.error("Send review email error:", error);
    return NextResponse.json(
      { error: "이메일 발송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
