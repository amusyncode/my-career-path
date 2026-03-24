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

const COUNSELING_TYPE_LABELS: Record<string, string> = {
  career: "진로 상담",
  academic: "학업 상담",
  personal: "개인 상담",
  college: "대학 입시 상담",
  general: "일반 상담",
};

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

    const { counselingId, studentId } = await request.json();

    if (!counselingId || !studentId) {
      return NextResponse.json(
        { error: "counselingId와 studentId는 필수입니다." },
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

    // Fetch counseling record
    const { data: counseling, error: counselingError } = await supabase
      .from("counseling_records")
      .select("*")
      .eq("id", counselingId)
      .single();

    if (counselingError || !counseling) {
      return NextResponse.json({ error: "상담 기록을 찾을 수 없습니다." }, { status: 404 });
    }

    const counselingType = COUNSELING_TYPE_LABELS[counseling.counseling_type] || counseling.counseling_type || "상담";
    const counselingDate = counseling.counseling_date
      ? new Date(counseling.counseling_date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
      : "-";

    // Build action items
    const actionItems = counseling.action_items ?? [];
    let actionItemsHtml = "";
    if (Array.isArray(actionItems) && actionItems.length > 0) {
      actionItemsHtml = `
        <div style="margin-top:24px;">
          <h3 style="margin:0 0 12px;color:#1e40af;font-size:16px;font-weight:600;">실천 과제</h3>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${actionItems.map((item: string, idx: number) => `
              <tr>
                <td style="padding:10px 12px;background-color:${idx % 2 === 0 ? "#f9fafb" : "#ffffff"};border-radius:4px;">
                  <span style="display:inline-block;width:24px;height:24px;background-color:#3B82F6;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:600;margin-right:10px;">${idx + 1}</span>
                  <span style="color:#374151;font-size:14px;">${item}</span>
                </td>
              </tr>
            `).join("")}
          </table>
        </div>`;
    }

    const nextCounselingDate = counseling.next_counseling_date
      ? new Date(counseling.next_counseling_date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
      : null;

    const subject = `[MyCareerPath] ${counselingType} 기록 - ${student.name}님`;
    const emailBody = `
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">안녕하세요, <strong>${student.name}</strong>님!</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
        담당 선생님(${profile?.name || "선생님"})이 상담 기록을 공유합니다.
      </p>

      <div style="background-color:#eff6ff;border-radius:8px;padding:20px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 0;color:#6b7280;font-size:13px;width:100px;">상담 유형</td>
            <td style="padding:4px 0;color:#1e40af;font-size:14px;font-weight:600;">${counselingType}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#6b7280;font-size:13px;">상담 일자</td>
            <td style="padding:4px 0;color:#374151;font-size:14px;">${counselingDate}</td>
          </tr>
          ${nextCounselingDate ? `
          <tr>
            <td style="padding:4px 0;color:#6b7280;font-size:13px;">다음 상담</td>
            <td style="padding:4px 0;color:#dc2626;font-size:14px;font-weight:600;">${nextCounselingDate}</td>
          </tr>` : ""}
        </table>
      </div>

      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px;color:#1e40af;font-size:16px;font-weight:600;">상담 내용</h3>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;background-color:#f9fafb;padding:16px;border-radius:8px;border-left:4px solid #3B82F6;">
          ${counseling.content || "내용 없음"}
        </p>
      </div>

      ${counseling.instructor_notes ? `
      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px;color:#1e40af;font-size:16px;font-weight:600;">선생님 코멘트</h3>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;background-color:#fefce8;padding:16px;border-radius:8px;border-left:4px solid #eab308;">
          ${counseling.instructor_notes}
        </p>
      </div>` : ""}

      ${actionItemsHtml}

      <div style="margin-top:32px;text-align:center;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://my-career-path-seven.vercel.app"}/dashboard"
           style="display:inline-block;padding:12px 32px;background-color:#3B82F6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
          MyCareerPath에서 확인하기
        </a>
      </div>
    `;

    const html = buildEmailHtml("상담 기록 안내", emailBody);

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
      content_type: "counseling",
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
    console.error("Send counseling email error:", error);
    return NextResponse.json(
      { error: "이메일 발송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
