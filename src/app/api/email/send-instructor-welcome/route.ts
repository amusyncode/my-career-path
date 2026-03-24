import { NextRequest, NextResponse } from "next/server";
import { withSuperAdminAuth } from "@/lib/super-admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
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
  const { error: authError, userId } = await withSuperAdminAuth();
  if (authError) return authError;

  try {
    const { instructorId, email, tempPassword, inviteCode } = await request.json();

    if (!instructorId || !email || !tempPassword || !inviteCode) {
      return NextResponse.json(
        { error: "instructorId, email, tempPassword, inviteCode는 필수입니다." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Fetch instructor profile for name
    const { data: instructor } = await adminClient
      .from("profiles")
      .select("name")
      .eq("id", instructorId)
      .single();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://my-career-path-seven.vercel.app";
    const loginUrl = `${siteUrl}/login`;

    const subject = `[MyCareerPath] 강사 계정이 생성되었습니다`;
    const emailBody = `
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">안녕하세요, <strong>${instructor?.name || "선생님"}</strong>!</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
        MyCareerPath 강사 계정이 생성되었습니다. 아래 정보로 로그인해 주세요.
      </p>

      <div style="background-color:#eff6ff;border-radius:8px;padding:24px;margin-bottom:24px;">
        <h3 style="margin:0 0 16px;color:#1e40af;font-size:16px;font-weight:600;">계정 정보</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px;vertical-align:top;">이메일 (로그인 ID)</td>
            <td style="padding:8px 0;color:#374151;font-size:14px;font-weight:600;">${email}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">임시 비밀번호</td>
            <td style="padding:8px 0;">
              <code style="background-color:#fee2e2;color:#dc2626;padding:4px 12px;border-radius:4px;font-size:14px;font-weight:700;letter-spacing:0.5px;">${tempPassword}</code>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">초대 코드</td>
            <td style="padding:8px 0;">
              <code style="background-color:#dbeafe;color:#1e40af;padding:4px 12px;border-radius:4px;font-size:14px;font-weight:700;letter-spacing:1px;">${inviteCode}</code>
            </td>
          </tr>
        </table>
      </div>

      <div style="background-color:#fefce8;border-radius:8px;padding:16px;margin-bottom:24px;border-left:4px solid #eab308;">
        <p style="margin:0;color:#854d0e;font-size:13px;line-height:1.6;">
          <strong>보안 안내:</strong> 첫 로그인 후 반드시 비밀번호를 변경해 주세요.<br/>
          초대 코드는 학생 등록 시 사용됩니다. 안전하게 보관해 주세요.
        </p>
      </div>

      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px;color:#1e40af;font-size:16px;font-weight:600;">시작하기</h3>
        <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
          <li>아래 버튼을 클릭하여 로그인 페이지로 이동</li>
          <li>이메일과 임시 비밀번호로 로그인</li>
          <li>비밀번호 변경 및 프로필 설정</li>
          <li>초대 코드를 학생에게 공유하여 학생 등록</li>
        </ol>
      </div>

      <div style="text-align:center;margin-top:32px;">
        <a href="${loginUrl}"
           style="display:inline-block;padding:14px 40px;background-color:#3B82F6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
          로그인하기
        </a>
        <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">버튼이 작동하지 않으면 아래 링크를 복사하세요:</p>
        <p style="margin:4px 0 0;color:#3B82F6;font-size:12px;word-break:break-all;">${loginUrl}</p>
      </div>
    `;

    const html = buildEmailHtml("강사 계정 생성 안내", emailBody);

    // Send email via Resend
    const { error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject,
      html,
    });

    const status = sendError ? "failed" : "sent";

    // Log to email_logs using admin client (bypasses RLS)
    await adminClient.from("email_logs").insert({
      instructor_id: userId,
      student_id: null,
      recipient_email: email,
      subject,
      content_type: "instructor_welcome",
      status,
      sent_at: new Date().toISOString(),
      error_message: sendError?.message || null,
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return NextResponse.json({ error: "이메일 발송에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, recipientEmail: email });
  } catch (error) {
    console.error("Send instructor welcome email error:", error);
    return NextResponse.json(
      { error: "이메일 발송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
