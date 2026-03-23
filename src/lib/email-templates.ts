// AI Review email template
export function buildReviewEmailHTML(data: {
  studentName: string;
  instructorName: string;
  documentType: "resume" | "cover_letter";
  overallScore: number;
  feedback: string;
  improvementPoints: { category: string; score: number; comment: string }[];
}): { subject: string; html: string } {
  const docLabel = data.documentType === "resume" ? "이력서" : "자기소개서";
  const subject = `[MyCareerPath] ${data.studentName}님의 ${docLabel} AI 첨삭 결과`;

  const scoreColor = data.overallScore >= 80 ? "#16a34a" : data.overallScore >= 60 ? "#ca8a04" : "#dc2626";

  let pointsHTML = "";
  data.improvementPoints.forEach((p) => {
    pointsHTML += `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:500">${p.category}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;font-weight:bold">${p.score}점</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280">${p.comment}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f9fafb">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#7c3aed,#3b82f6);border-radius:16px 16px 0 0;padding:24px;text-align:center">
    <h1 style="color:white;margin:0;font-size:20px">AI ${docLabel} 첨삭 결과</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">${data.studentName}님</p>
  </div>
  <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:${scoreColor}15;border:2px solid ${scoreColor};border-radius:50%;width:80px;height:80px;line-height:80px;font-size:28px;font-weight:bold;color:${scoreColor}">${data.overallScore}</div>
      <p style="color:#6b7280;font-size:14px;margin:8px 0 0">총점</p>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px">
      <h3 style="margin:0 0 8px;font-size:14px;color:#374151">📋 종합 피드백</h3>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">${data.feedback}</p>
    </div>
    ${pointsHTML ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:8px 12px;text-align:left">항목</th>
        <th style="padding:8px 12px;text-align:center">점수</th>
        <th style="padding:8px 12px;text-align:left">코멘트</th>
      </tr></thead>
      <tbody>${pointsHTML}</tbody>
    </table>` : ""}
  </div>
  <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
    ${data.instructorName} 강사님이 발송 · MyCareerPath
  </div>
</div>
</body></html>`;

  return { subject, html };
}

// Counseling record email template
export function buildCounselingEmailHTML(data: {
  studentName: string;
  instructorName: string;
  title: string;
  counselingType: string;
  counselingDate: string;
  content: string | null;
  actionItems: string | null;
  nextCounselingDate: string | null;
}): { subject: string; html: string } {
  const typeMap: Record<string, string> = {
    career: "진로상담", resume: "이력서상담", interview: "면접준비", mental: "고충상담", other: "기타",
  };
  const subject = `[MyCareerPath] ${data.studentName}님 상담 기록 - ${data.title}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f9fafb">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:16px 16px 0 0;padding:24px">
    <h1 style="color:white;margin:0;font-size:20px">상담 기록</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">${data.studentName}님 · ${typeMap[data.counselingType] || data.counselingType}</p>
  </div>
  <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none">
    <div style="margin-bottom:20px">
      <h3 style="margin:0 0 4px;font-size:16px;color:#1f2937">${data.title}</h3>
      <p style="margin:0;font-size:13px;color:#9ca3af">상담일: ${data.counselingDate}</p>
    </div>
    ${data.content ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:16px">
      <h4 style="margin:0 0 8px;font-size:13px;color:#374151">📋 상담 내용</h4>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;white-space:pre-wrap">${data.content}</p>
    </div>` : ""}
    ${data.actionItems ? `<div style="background:#ecfdf5;border-radius:8px;padding:16px;margin-bottom:16px">
      <h4 style="margin:0 0 8px;font-size:13px;color:#065f46">✅ 후속 조치</h4>
      <p style="margin:0;font-size:13px;color:#047857;line-height:1.6;white-space:pre-wrap">${data.actionItems}</p>
    </div>` : ""}
    ${data.nextCounselingDate ? `<div style="background:#eff6ff;border-radius:8px;padding:12px;text-align:center">
      <p style="margin:0;font-size:13px;color:#1d4ed8">📅 다음 상담 예정일: ${data.nextCounselingDate}</p>
    </div>` : ""}
  </div>
  <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
    ${data.instructorName} 강사님이 발송 · MyCareerPath
  </div>
</div>
</body></html>`;

  return { subject, html };
}

// AI Suggestion email template
export function buildSuggestionEmailHTML(data: {
  studentName: string;
  instructorName: string;
  suggestedTopics: string[];
  keyObservations: string[];
  actionSuggestions: string[];
  concerns?: string[];
  encouragement: string;
}): { subject: string; html: string } {
  const subject = `[MyCareerPath] ${data.studentName}님을 위한 AI 상담 제안`;

  const topicsHTML = data.suggestedTopics.map((t, i) =>
    `<div style="background:#f3e8ff;border-radius:8px;padding:10px 14px;margin-bottom:6px;font-size:13px;color:#6b21a8"><strong>${i+1}.</strong> ${t}</div>`
  ).join("");

  const obsHTML = data.keyObservations.map(o =>
    `<li style="margin-bottom:4px;font-size:13px;color:#6b7280">${o}</li>`
  ).join("");

  const actionsHTML = data.actionSuggestions.map(a =>
    `<li style="margin-bottom:4px;font-size:13px;color:#6b7280">${a}</li>`
  ).join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f9fafb">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);border-radius:16px 16px 0 0;padding:24px;text-align:center">
    <h1 style="color:white;margin:0;font-size:20px">AI 상담 제안</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">${data.studentName}님</p>
  </div>
  <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none">
    ${topicsHTML ? `<div style="margin-bottom:20px">
      <h3 style="margin:0 0 10px;font-size:14px;color:#374151">💡 추천 상담 주제</h3>
      ${topicsHTML}
    </div>` : ""}
    ${obsHTML ? `<div style="margin-bottom:20px">
      <h3 style="margin:0 0 10px;font-size:14px;color:#374151">👁 주요 관찰 사항</h3>
      <ul style="margin:0;padding-left:20px">${obsHTML}</ul>
    </div>` : ""}
    ${actionsHTML ? `<div style="margin-bottom:20px">
      <h3 style="margin:0 0 10px;font-size:14px;color:#374151">🎯 추천 활동</h3>
      <ul style="margin:0;padding-left:20px">${actionsHTML}</ul>
    </div>` : ""}
    ${data.encouragement ? `<div style="background:#ecfdf5;border-radius:8px;padding:16px;border-left:4px solid #10b981">
      <p style="margin:0;font-size:13px;color:#065f46;font-style:italic">${data.encouragement}</p>
    </div>` : ""}
  </div>
  <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
    ${data.instructorName} 강사님이 발송 · MyCareerPath
  </div>
</div>
</body></html>`;

  return { subject, html };
}
